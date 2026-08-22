/**
 * Pintor web beta: private PDF jobs, conservative result viewer, and typed expert-review evidence.
 */

import { App, i18n } from '../src/core/app.js';
import { localizedFetchError } from './pintor-network.js';
import { parsePageSelection } from './pintor-pages.js';

const TERMINAL_STATES = new Set(['ready', 'declined', 'failed', 'revision-requested']);
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const ERROR_LABEL_KEYS = {
    'wrong-colour': 'errors.wrongColour',
    'non-wire': 'errors.nonWire',
    missing: 'errors.missing',
    'stops-mid': 'errors.stops',
    bleed: 'errors.bleed',
    'dash-style': 'errors.dashStyle',
    'stripe-style': 'errors.stripeStyle'
};

class PintorApp extends App {
    constructor() {
        super({
            appName: 'pintor',
            callbacks: {
                aoInicializar: () => this.setup(),
                aoTrocarIdioma: () => this.updateLanguage()
            }
        });
        this.apiBase = this.resolveApiBase();
        this.account = null;
        this.accountsRequired = false;
        this.adminFeedback = [];
        this.adminReport = null;
        this.adminView = 'painted';
        this.adminSection = 'reports';
        this.adminAccounts = [];
        this.adminRounds = [];
        this.adminRound = null;
        this.openRoundId = null;
        this.jobs = [];
        this.jobsSince = 0;
        this.jobsTimer = null;
        this.job = null;
        this.pollToken = 0;
        this.annotations = [];
        this.activeTool = null;
        this.pendingPoints = [];
        this.viewer = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            width: 0,
            height: 0,
            dragging: null,
            currentPage: 0,
            currentView: 'painted'
        };
    }

    resolveApiBase() {
        if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            return 'http://127.0.0.1:8765/api/';
        }
        return (
            document.querySelector('meta[name="pintor-api-base"]')?.content ||
            'https://pintor-api.engnata.eu/api/'
        );
    }

    apiUrl(path) {
        return new URL(path, this.apiBase).toString();
    }

    setup() {
        this.bindAccess();
        this.bindAccounts();
        this.bindOwnJobs();
        this.bindAdmin();
        this.bindUpload();
        this.bindViewer();
        this.bindFeedback();
        this.updateLanguage();
        void this.checkAccess();
    }

    bindAccess() {
        document.getElementById('accessForm').addEventListener('submit', event => {
            void this.submitAccess(event);
        });
    }

    async checkAccess() {
        this.showOnly('access');
        const status = document.getElementById('accessStatus');
        status.hidden = true;
        try {
            const response = await fetch(this.apiUrl('health'), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('access.unavailable'));
            }
            if (!body.access_required || body.authenticated) {
                this.accountsRequired = Boolean(body.accounts_required);
                await this.checkAccount();
            }
        } catch (error) {
            this.showFetchStatus(status, error, 'access.unavailable');
        }
    }

    async submitAccess(event) {
        event.preventDefault();
        const code = document.getElementById('accessCode').value.trim();
        const status = document.getElementById('accessStatus');
        const button = document.getElementById('accessButton');
        if (!code) {
            this.showStatus(status, i18n.t('access.required'), 'error');
            return;
        }
        button.disabled = true;
        button.querySelector('span').textContent = i18n.t('access.unlocking');
        try {
            const response = await fetch(this.apiUrl('access'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                const fallback = response.status === 429 ? 'access.rateLimited' : 'access.invalid';
                throw new Error(i18n.t(fallback) || body.detail);
            }
            document.getElementById('accessCode').value = '';
            await this.checkAccount();
        } catch (error) {
            this.showFetchStatus(status, error, 'access.unavailable');
        } finally {
            button.disabled = false;
            button.querySelector('span').textContent = i18n.t('access.submit');
        }
    }

    bindAccounts() {
        document.getElementById('loginForm').addEventListener('submit', event => {
            void this.submitAccount(event, 'login');
        });
        document.getElementById('registerForm').addEventListener('submit', event => {
            void this.submitAccount(event, 'register');
        });
        document.getElementById('logoutButton').addEventListener('click', () => {
            void this.logout();
        });
    }

    async checkAccount() {
        try {
            const response = await fetch(this.apiUrl('account'), {
                credentials: 'include',
                cache: 'no-store'
            });
            if (response.ok) {
                const body = await this.readResponse(response);
                this.activateAccount(body.account);
                return;
            }
            if (response.status !== 401) {
                const body = await this.readResponse(response);
                throw new Error(body.detail || i18n.t('account.unavailable'));
            }
            this.account = null;
            this.showOnly(this.accountsRequired ? 'account' : 'upload');
        } catch (error) {
            this.showOnly(this.accountsRequired ? 'account' : 'upload');
            this.showStatus(
                document.getElementById('accountStatus'),
                localizedFetchError(error, i18n.t('account.unavailable')),
                'error'
            );
        }
    }

    async submitAccount(event, mode) {
        event.preventDefault();
        const form = event.currentTarget;
        const prefix = mode === 'login' ? 'login' : 'register';
        const username = document.getElementById(`${prefix}Username`).value.trim();
        const password = document.getElementById(`${prefix}Password`).value;
        const status = document.getElementById('accountStatus');
        const button = document.getElementById(`${prefix}Button`);
        if (!username) {
            this.showStatus(status, i18n.t('account.usernameRequired'), 'error');
            return;
        }
        if (password.length < 4) {
            this.showStatus(status, i18n.t('account.passwordShort'), 'error');
            return;
        }
        button.disabled = true;
        try {
            const path = mode === 'login' ? 'accounts/login' : 'accounts/register';
            const response = await fetch(this.apiUrl(path), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                let key = mode === 'login' ? 'account.invalid' : 'account.createFailed';
                if (response.status === 409) {
                    key = 'account.duplicate';
                } else if (response.status === 403) {
                    key = 'account.suspended';
                } else if (response.status === 429) {
                    key = 'account.rateLimited';
                }
                throw new Error(i18n.t(key) || body.detail);
            }
            form.reset();
            this.activateAccount(body.account);
        } catch (error) {
            this.showStatus(
                status,
                localizedFetchError(error, i18n.t('account.unavailable')),
                'error'
            );
        } finally {
            button.disabled = false;
        }
    }

    activateAccount(account) {
        this.account = account;
        document.getElementById('accountName').textContent = account.username;
        document.getElementById('openAdmin').hidden = account.role !== 'admin';
        document.getElementById('accountStatus').hidden = true;
        this.showOnly('upload');
    }

    async logout() {
        try {
            await fetch(this.apiUrl('accounts/logout'), {
                method: 'POST',
                credentials: 'include'
            });
        } finally {
            this.account = null;
            this.job = null;
            this.annotations = [];
            this.adminFeedback = [];
            this.adminReport = null;
            this.adminAccounts = [];
            this.adminRounds = [];
            this.adminRound = null;
            this.jobs = [];
            window.clearTimeout(this.jobsTimer);
            this.showOnly(this.accountsRequired ? 'account' : 'upload');
        }
    }

    bindOwnJobs() {
        document.getElementById('openJobs').addEventListener('click', () => {
            void this.openOwnJobs();
        });
        document.getElementById('closeJobs').addEventListener('click', () => {
            window.clearTimeout(this.jobsTimer);
            this.showOnly('upload');
        });
        document.getElementById('deleteAccountForm').addEventListener('submit', event => {
            void this.deleteOwnAccount(event);
        });
    }

    async openOwnJobs() {
        this.showOnly('jobs');
        document.getElementById('deleteAccountPassword').value = '';
        document.getElementById('jobsStatus').hidden = true;
        await this.refreshOwnJobs();
    }

    async refreshOwnJobs(quiet = false) {
        const status = document.getElementById('jobsStatus');
        try {
            const response = await fetch(this.apiUrl('account/jobs'), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('jobs.loadFailed'));
            }
            this.jobs = body.jobs || [];
            this.jobsSince = body.since || 0;
            this.renderStorage(body);
            this.renderOwnJobs();
            this.scheduleJobsRefresh();
        } catch (error) {
            if (!quiet) {
                this.jobs = [];
                this.renderOwnJobs();
                this.showFetchStatus(status, error, 'jobs.loadFailed');
            }
        }
    }

    renderStorage(body) {
        const line = document.getElementById('jobsStorage');
        if (!body.storage_limit_bytes) {
            line.hidden = true;
            return;
        }
        line.hidden = false;
        const share = Math.round((body.storage_used_bytes / body.storage_limit_bytes) * 100);
        line.textContent = i18n
            .t('jobs.storage')
            .replace('{used}', this.formatBytes(body.storage_used_bytes || 0))
            .replace('{limit}', this.formatBytes(body.storage_limit_bytes))
            .replace('{percent}', String(Math.min(share, 100)))
            .replace('{hours}', String(body.retention_hours || 24));
        line.classList.toggle('is-tight', share >= 85);
    }

    scheduleJobsRefresh() {
        window.clearTimeout(this.jobsTimer);
        const working = this.jobs.some(job => ['queued', 'processing'].includes(job.status));
        // Polling only exists while something is moving; a settled list stops asking.
        if (!working || document.getElementById('jobsPanel').hidden) {
            return;
        }
        this.jobsTimer = window.setTimeout(() => void this.refreshOwnJobs(true), 2500);
    }

    jobStatusLabel(state) {
        const key = {
            ready: 'jobs.statusReady',
            processing: 'jobs.statusProcessing',
            queued: 'jobs.statusQueued',
            declined: 'jobs.statusDeclined',
            failed: 'jobs.statusFailed',
            'revision-requested': 'jobs.statusRevision'
        }[state];
        return i18n.t(key || 'jobs.statusProcessing');
    }

    formatMoment(seconds) {
        return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date((seconds || 0) * 1000));
    }

    jobPagesLabel(job) {
        const pages = (job.selected_pages || []).map(page => Number(page) + 1);
        if (!pages.length) {
            return job.page_discovery === 'auto' ? i18n.t('jobs.sweeping') : '—';
        }
        const shown = pages.slice(0, 12).join(', ');
        const label = pages.length > 12 ? `${shown}… (${pages.length})` : shown;
        return job.page_discovery === 'auto'
            ? `${label} · ${i18n.t('jobs.found').replace('{count}', String(pages.length))}`
            : label;
    }

    jobRetentionLabel(job) {
        if (job.shared_for_improvement) {
            return i18n.t('jobs.shared');
        }
        if (!job.expires_at) {
            return '';
        }
        const remaining = job.expires_at * 1000 - Date.now();
        if (remaining <= 0) {
            return i18n.t('jobs.expiringNow');
        }
        // Round once, in minutes, or 23 h 59.7 min renders as "23 h 60 min".
        const totalMinutes = Math.max(1, Math.round(remaining / 60000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        let left = `${minutes} min`;
        if (hours) {
            left = minutes ? `${hours} h ${minutes} min` : `${hours} h`;
        }
        return i18n.t('jobs.expiresIn').replace('{left}', left);
    }

    jobProgressLabel(job) {
        if (job.status === 'queued') {
            return job.queue_position > 0
                ? i18n.t('jobs.queuePosition').replace('{position}', String(job.queue_position))
                : i18n.t('jobs.statusQueued');
        }
        if (job.status !== 'processing') {
            return '';
        }
        const stageKey = `processing.stages.${job.stage}`;
        const stage = i18n.t(stageKey);
        const label = stage === stageKey ? i18n.t('processing.working') : stage;
        if (job.stage === 'scanning-document' && job.page_count) {
            return `${label} · ${job.scanned_pages || 0}/${job.page_count}`;
        }
        if (job.selected_page_count) {
            const done = Number(job.completed_pages || 0) + 1;
            return `${label} · ${Math.min(done, job.selected_page_count)}/${job.selected_page_count}`;
        }
        return label;
    }

    renderOwnJobs() {
        const list = document.getElementById('jobsList');
        list.replaceChildren();
        if (!this.jobs.length) {
            const empty = document.createElement('p');
            empty.className = 'admin-empty';
            empty.textContent = i18n.t('jobs.empty');
            list.append(empty);
            return;
        }
        this.jobs.forEach(job => {
            const card = document.createElement('article');
            card.className = 'job-card';
            const working = ['queued', 'processing'].includes(job.status);
            if (working) {
                card.classList.add('is-working');
            }

            const heading = document.createElement('div');
            heading.className = 'job-card-heading';
            const title = document.createElement('strong');
            title.textContent = job.original_name || i18n.t('admin.unnamedDocument');
            heading.append(title);
            if (!working && job.finished_since_last_login) {
                const badge = document.createElement('span');
                badge.className = 'job-new-badge';
                badge.textContent = i18n.t('jobs.newSinceLastLogin');
                heading.append(badge);
            }
            const state = document.createElement('span');
            state.className = 'status-pill';
            state.textContent = this.jobStatusLabel(job.status);
            heading.append(state);

            const meta = document.createElement('p');
            meta.className = 'job-card-meta';
            const size = job.source_bytes ? ` · ${this.formatBytes(job.source_bytes)}` : '';
            meta.textContent =
                `${i18n.t('jobs.pages')} ${this.jobPagesLabel(job)} · ` +
                `${i18n.t('jobs.sent')} ${this.formatMoment(job.created_at)}${size}`;
            card.append(heading, meta);

            const retention = this.jobRetentionLabel(job);
            if (retention && !working) {
                const line = document.createElement('p');
                line.className = job.shared_for_improvement
                    ? 'job-card-retention is-shared'
                    : 'job-card-retention';
                line.textContent = retention;
                card.append(line);
            }

            const progress = this.jobProgressLabel(job);
            if (progress) {
                const line = document.createElement('p');
                line.className = 'job-card-progress';
                line.textContent = progress;
                card.append(line);
            }
            const declineText = this.declineReasonLabel(job);
            if (declineText) {
                const reason = document.createElement('p');
                reason.className = 'job-card-progress';
                reason.textContent = declineText;
                card.append(reason);
            }

            const actions = document.createElement('div');
            actions.className = 'job-card-actions';
            if (job.status === 'ready' || job.status === 'revision-requested') {
                const open = document.createElement('button');
                open.type = 'button';
                open.className = 'secondary-button compact-button';
                open.textContent = i18n.t('jobs.open');
                open.addEventListener('click', () => void this.openStoredJob(job.id));
                const download = document.createElement('a');
                download.className = 'secondary-button compact-button';
                download.href = this.apiUrl(`jobs/${job.id}/download`);
                download.textContent = i18n.t('jobs.download');
                actions.append(open, download);
            }
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'text-button danger-text';
            remove.textContent = i18n.t('jobs.delete');
            remove.addEventListener('click', () => void this.deleteOwnJob(job.id));
            actions.append(remove);

            card.append(actions);
            list.append(card);
        });
    }

    declineReasonLabel(job) {
        if (job.status !== 'declined') {
            return '';
        }
        if (job.stage === 'no-wiring-page') {
            return i18n.t('messages.noWiringPage');
        }
        return job.decline_reason || '';
    }

    async openStoredJob(jobId) {
        const status = document.getElementById('jobsStatus');
        try {
            const response = await fetch(this.apiUrl(`jobs/${jobId}`), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('jobs.loadFailed'));
            }
            window.clearTimeout(this.jobsTimer);
            this.job = body;
            this.annotations = [];
            this.handleTerminalJob(body);
        } catch (error) {
            this.showFetchStatus(status, error, 'jobs.loadFailed');
        }
    }

    async deleteOwnJob(jobId) {
        if (!window.confirm(i18n.t('jobs.confirmDelete'))) {
            return;
        }
        const status = document.getElementById('jobsStatus');
        try {
            const response = await fetch(this.apiUrl(`jobs/${jobId}`), {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                const body = await this.readResponse(response);
                throw new Error(body.detail || i18n.t('jobs.deleteFailed'));
            }
            if (this.job?.id === jobId) {
                this.job = null;
                this.annotations = [];
            }
            this.jobs = this.jobs.filter(job => job.id !== jobId);
            this.renderOwnJobs();
            this.showStatus(status, i18n.t('jobs.deleted'), 'success', 'jobs.deleted');
        } catch (error) {
            this.showFetchStatus(status, error, 'jobs.deleteFailed');
        }
    }

    async deleteOwnAccount(event) {
        event.preventDefault();
        const status = document.getElementById('jobsStatus');
        const field = document.getElementById('deleteAccountPassword');
        const button = document.getElementById('deleteAccountButton');
        const password = field.value;
        if (!password) {
            this.showStatus(status, i18n.t('jobs.wrongPassword'), 'error', 'jobs.wrongPassword');
            return;
        }
        if (!window.confirm(i18n.t('jobs.confirmAccount'))) {
            return;
        }
        button.disabled = true;
        try {
            const response = await fetch(this.apiUrl('account'), {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!response.ok) {
                const body = await this.readResponse(response);
                const key =
                    response.status === 401 ? 'jobs.wrongPassword' : 'jobs.accountDeleteFailed';
                throw new Error(i18n.t(key) || body.detail);
            }
            field.value = '';
            this.account = null;
            this.job = null;
            this.jobs = [];
            this.annotations = [];
            this.showOnly(this.accountsRequired ? 'account' : 'upload');
            this.showStatus(
                document.getElementById('accountStatus'),
                i18n.t('jobs.accountDeleted'),
                'success',
                'jobs.accountDeleted'
            );
        } catch (error) {
            this.showFetchStatus(status, error, 'jobs.accountDeleteFailed');
        } finally {
            button.disabled = false;
        }
    }

    bindAdmin() {
        document.getElementById('openAdmin').addEventListener('click', () => {
            void this.openAdmin();
        });
        document.getElementById('closeAdmin').addEventListener('click', () => {
            this.showOnly('upload');
        });
        document.getElementById('adminPage').addEventListener('change', () => {
            this.renderAdminPreview();
            this.renderAdminAnnotations();
        });
        document.getElementById('adminShowPainted').addEventListener('click', () => {
            this.adminView = 'painted';
            this.renderAdminPreview();
        });
        document.getElementById('adminShowOriginal').addEventListener('click', () => {
            this.adminView = 'original';
            this.renderAdminPreview();
        });
        document.querySelector('.admin-decisions').addEventListener('click', event => {
            const button = event.target.closest('[data-decision]');
            if (button) {
                void this.decideFeedback(button.dataset.decision);
            }
        });
        document.querySelector('.admin-tabs').addEventListener('click', event => {
            const tab = event.target.closest('[data-admin-view]');
            if (tab) {
                void this.showAdminSection(tab.dataset.adminView);
            }
        });
        document.getElementById('roundForm').addEventListener('submit', event => {
            void this.createRound(event);
        });
        document.getElementById('adminRoundClose').addEventListener('click', () => {
            void this.closeRound();
        });
    }

    async showAdminSection(section) {
        this.adminSection = section;
        document.querySelectorAll('.admin-tabs [data-admin-view]').forEach(tab => {
            tab.classList.toggle('is-active', tab.dataset.adminView === section);
        });
        document.getElementById('adminViewReports').hidden = section !== 'reports';
        document.getElementById('adminViewAccounts').hidden = section !== 'accounts';
        document.getElementById('adminViewRounds').hidden = section !== 'rounds';
        document.getElementById('adminStatus').hidden = true;
        if (section === 'accounts') {
            await this.loadAccounts();
        } else if (section === 'rounds') {
            await this.loadRounds();
        }
    }

    async openAdmin() {
        if (this.account?.role !== 'admin') {
            return;
        }
        this.showOnly('admin');
        const status = document.getElementById('adminStatus');
        status.hidden = true;
        this.adminSection = 'reports';
        document.querySelectorAll('.admin-tabs [data-admin-view]').forEach(tab => {
            tab.classList.toggle('is-active', tab.dataset.adminView === 'reports');
        });
        document.getElementById('adminViewReports').hidden = false;
        document.getElementById('adminViewAccounts').hidden = true;
        document.getElementById('adminViewRounds').hidden = true;
        try {
            const response = await fetch(this.apiUrl('admin/feedback'), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.loadFailed'));
            }
            this.adminFeedback = body.feedback || [];
            this.renderAdminQueue();
            if (this.adminFeedback.length) {
                await this.openFeedback(this.adminFeedback[0].id);
            } else {
                this.adminReport = null;
                document.getElementById('adminDetail').hidden = true;
                this.showStatus(status, i18n.t('admin.empty'), 'success');
            }
        } catch (error) {
            this.showStatus(
                status,
                localizedFetchError(error, i18n.t('admin.loadFailed')),
                'error'
            );
        }
    }

    renderAdminQueue() {
        const list = document.getElementById('adminFeedbackList');
        list.replaceChildren();
        document.getElementById('adminQueueCount').textContent = String(this.adminFeedback.length);
        this.adminFeedback.forEach(report => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'admin-feedback-item';
            if (report.id === this.adminReport?.id) {
                button.classList.add('is-active');
            }
            button.dataset.feedbackId = report.id;
            const title = document.createElement('strong');
            title.textContent = report.original_name || i18n.t('admin.unnamedDocument');
            const meta = document.createElement('span');
            const pageNumbers = (report.pages || []).map(page => Number(page) + 1).join(', ');
            meta.textContent = `${report.account_username || i18n.t('admin.unknownUser')} · ${i18n.t('admin.page')} ${pageNumbers || '—'}`;
            const state = document.createElement('small');
            state.textContent = this.feedbackStatusLabel(report.status);
            button.append(title, meta, state);
            button.addEventListener('click', () => void this.openFeedback(report.id));
            list.append(button);
        });
    }

    async openFeedback(feedbackId) {
        const response = await fetch(this.apiUrl(`admin/feedback/${feedbackId}`), {
            credentials: 'include',
            cache: 'no-store'
        });
        const body = await this.readResponse(response);
        if (!response.ok) {
            this.showStatus(
                document.getElementById('adminStatus'),
                body.detail || i18n.t('admin.loadFailed'),
                'error'
            );
            return;
        }
        this.adminReport = body.feedback;
        this.adminView = 'painted';
        document.getElementById('adminDetail').hidden = false;
        document.getElementById('adminReporter').textContent =
            this.adminReport.account_username || i18n.t('admin.unknownUser');
        document.getElementById('adminCreated').textContent = new Intl.DateTimeFormat(
            document.documentElement.lang || undefined,
            { dateStyle: 'medium', timeStyle: 'short' }
        ).format(new Date((this.adminReport.created_at || 0) * 1000));
        document.getElementById('adminFeedbackStatus').textContent = this.feedbackStatusLabel(
            this.adminReport.status
        );
        document.getElementById('adminNote').textContent = this.adminReport.note || '';
        document.getElementById('adminDecisionNote').value = this.adminReport.review_note || '';
        const picker = document.getElementById('adminPage');
        picker.replaceChildren();
        (this.adminReport.pages || []).forEach(page => {
            const option = document.createElement('option');
            option.value = String(page);
            option.textContent = `${i18n.t('admin.page')} ${Number(page) + 1}`;
            picker.append(option);
        });
        this.renderAdminQueue();
        this.renderAdminPreview();
        this.renderAdminAnnotations();
    }

    feedbackStatusLabel(status) {
        const key = {
            'queued-for-review': 'admin.statusQueued',
            'expert-accepted': 'admin.statusAccepted',
            'expert-rejected': 'admin.statusRejected',
            'expert-needs-clarification': 'admin.statusClarification'
        }[status];
        return i18n.t(key || 'admin.statusQueued');
    }

    renderAdminPreview() {
        if (!this.adminReport) {
            return;
        }
        const page = Number(document.getElementById('adminPage').value);
        const image = document.getElementById('adminPreview');
        image.onload = () => {
            document.getElementById('adminAnnotationLayer').style.height =
                `${image.clientHeight}px`;
        };
        image.src = this.apiUrl(
            `admin/feedback/${this.adminReport.id}/preview/${this.adminView}?page=${page}`
        );
        image.alt = `${i18n.t(`review.${this.adminView}`)} · ${i18n.t('admin.page')} ${page + 1}`;
        document
            .getElementById('adminShowPainted')
            .classList.toggle('is-active', this.adminView === 'painted');
        document
            .getElementById('adminShowOriginal')
            .classList.toggle('is-active', this.adminView === 'original');
    }

    renderAdminAnnotations() {
        const layer = document.getElementById('adminAnnotationLayer');
        const list = document.getElementById('adminAnnotations');
        layer.replaceChildren();
        list.replaceChildren();
        if (!this.adminReport) {
            return;
        }
        const page = Number(document.getElementById('adminPage').value);
        (this.adminReport.annotations || [])
            .filter(annotation => Number(annotation.page) === page)
            .forEach((annotation, index) => {
                const points = annotation.geometry?.points || [];
                if (!points.length) {
                    return;
                }
                const marker = document.createElement('span');
                marker.className = `admin-marker ${points.length === 2 ? 'is-segment' : 'is-point'}`;
                if (points.length === 1) {
                    marker.style.left = `${points[0][0] * 100}%`;
                    marker.style.top = `${points[0][1] * 100}%`;
                    marker.textContent = String(index + 1);
                } else {
                    const [start, end] = points;
                    const dx = (end[0] - start[0]) * 100;
                    const dy = (end[1] - start[1]) * 100;
                    marker.style.left = `${start[0] * 100}%`;
                    marker.style.top = `${start[1] * 100}%`;
                    marker.style.width = `${Math.hypot(dx, dy)}%`;
                    marker.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
                }
                layer.append(marker);
                const item = document.createElement('p');
                const expected = annotation.expected_code ? ` · ${annotation.expected_code}` : '';
                item.textContent = `${index + 1}. ${this.errorLabel(annotation.type)}${expected}`;
                list.append(item);
            });
    }

    errorLabel(type) {
        return i18n.t(ERROR_LABEL_KEYS[type] || type);
    }

    async decideFeedback(decision) {
        if (!this.adminReport) {
            return;
        }
        const buttons = document.querySelectorAll('.admin-decisions button');
        buttons.forEach(button => {
            button.disabled = true;
        });
        try {
            const response = await fetch(
                this.apiUrl(`admin/feedback/${this.adminReport.id}/decision`),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        decision,
                        note: document.getElementById('adminDecisionNote').value.trim()
                    })
                }
            );
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.decisionFailed'));
            }
            this.adminReport = body.feedback;
            const index = this.adminFeedback.findIndex(item => item.id === this.adminReport.id);
            if (index >= 0) {
                this.adminFeedback[index] = {
                    ...this.adminFeedback[index],
                    status: this.adminReport.status
                };
            }
            document.getElementById('adminFeedbackStatus').textContent = this.feedbackStatusLabel(
                this.adminReport.status
            );
            this.renderAdminQueue();
            this.showStatus(
                document.getElementById('adminStatus'),
                i18n.t('admin.decisionSaved'),
                'success'
            );
        } catch (error) {
            this.showStatus(
                document.getElementById('adminStatus'),
                localizedFetchError(error, i18n.t('admin.decisionFailed')),
                'error'
            );
        } finally {
            buttons.forEach(button => {
                button.disabled = false;
            });
        }
    }

    // ---- Account administration ------------------------------------------------------

    async loadAccounts() {
        const status = document.getElementById('adminStatus');
        try {
            const response = await fetch(this.apiUrl('admin/accounts'), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.accountsFailed'));
            }
            this.adminAccounts = body.accounts || [];
            this.renderAccounts();
        } catch (error) {
            this.adminAccounts = [];
            this.renderAccounts();
            this.showFetchStatus(status, error, 'admin.accountsFailed');
        }
    }

    renderAccounts() {
        const body = document.getElementById('adminAccountsBody');
        body.replaceChildren();
        if (!this.adminAccounts.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'admin-empty';
            cell.textContent = i18n.t('admin.accountsEmpty');
            row.append(cell);
            body.append(row);
            return;
        }
        this.adminAccounts.forEach(account => {
            const row = document.createElement('tr');
            if (account.status === 'suspended') {
                row.classList.add('is-suspended');
            }

            const name = document.createElement('td');
            const label = document.createElement('strong');
            label.textContent = account.username;
            name.append(label);
            if (account.is_self) {
                const self = document.createElement('small');
                self.textContent = ` (${i18n.t('admin.you')})`;
                name.append(self);
            }

            const role = document.createElement('td');
            role.textContent = i18n.t(
                account.role === 'admin' ? 'admin.roleAdmin' : 'admin.roleUser'
            );

            const state = document.createElement('td');
            const pill = document.createElement('span');
            pill.className = 'status-pill';
            pill.textContent = i18n.t(
                account.status === 'suspended' ? 'admin.statusSuspended' : 'admin.statusActive'
            );
            state.append(pill);

            const jobs = document.createElement('td');
            jobs.textContent = String(account.job_count ?? 0);

            const storage = document.createElement('td');
            storage.textContent = this.formatBytes(account.storage_bytes || 0);

            const reports = document.createElement('td');
            reports.textContent = i18n
                .t('admin.reportsCount')
                .replace('{total}', String(account.report_count ?? 0))
                .replace('{accepted}', String(account.accepted_count ?? 0))
                .replace('{pending}', String(account.pending_count ?? 0));

            const seen = document.createElement('td');
            seen.textContent = account.last_login_at
                ? this.formatMoment(account.last_login_at)
                : i18n.t('admin.never');

            const actions = document.createElement('td');
            actions.className = 'admin-row-actions';
            if (!account.is_self) {
                const suspended = account.status === 'suspended';
                actions.append(
                    this.accountAction(
                        i18n.t(suspended ? 'admin.reactivate' : 'admin.suspend'),
                        suspended
                            ? ''
                            : i18n.t('admin.confirmSuspend').replace('{user}', account.username),
                        () =>
                            this.changeAccount(account, 'status', {
                                status: suspended ? 'active' : 'suspended'
                            })
                    )
                );
                const promoting = account.role !== 'admin';
                actions.append(
                    this.accountAction(
                        i18n.t(promoting ? 'admin.promote' : 'admin.demote'),
                        i18n
                            .t(promoting ? 'admin.confirmPromote' : 'admin.confirmDemote')
                            .replace('{user}', account.username),
                        () =>
                            this.changeAccount(account, 'role', {
                                role: promoting ? 'admin' : 'user'
                            })
                    )
                );
                actions.append(
                    this.accountAction(
                        i18n.t('admin.removeAccount'),
                        i18n.t('admin.confirmRemove').replace('{user}', account.username),
                        () => this.removeAccount(account),
                        'danger-text'
                    )
                );
            } else {
                const locked = document.createElement('small');
                locked.textContent = i18n.t('admin.selfLocked');
                actions.append(locked);
            }

            row.append(name, role, state, jobs, storage, reports, seen, actions);
            body.append(row);
        });
    }

    accountAction(label, confirmation, run, extraClass = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `text-button${extraClass ? ` ${extraClass}` : ''}`;
        button.textContent = label;
        button.addEventListener('click', () => {
            if (confirmation && !window.confirm(confirmation)) {
                return;
            }
            void run();
        });
        return button;
    }

    async changeAccount(account, action, payload) {
        const status = document.getElementById('adminStatus');
        try {
            const response = await fetch(this.apiUrl(`admin/accounts/${account.id}/${action}`), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                const byStatus = { 409: 'admin.lastAdmin', 400: 'admin.selfLocked' };
                const key = byStatus[response.status] || 'admin.accountFailed';
                throw new Error(i18n.t(key) || body.detail);
            }
            await this.loadAccounts();
            this.showStatus(status, i18n.t('admin.accountSaved'), 'success', 'admin.accountSaved');
        } catch (error) {
            this.showFetchStatus(status, error, 'admin.accountFailed');
        }
    }

    async removeAccount(account) {
        const status = document.getElementById('adminStatus');
        try {
            const response = await fetch(this.apiUrl(`admin/accounts/${account.id}`), {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                const body = await this.readResponse(response);
                const key = response.status === 409 ? 'admin.lastAdmin' : 'admin.accountFailed';
                throw new Error(i18n.t(key) || body.detail);
            }
            await this.loadAccounts();
            this.showStatus(
                status,
                i18n.t('admin.accountRemoved'),
                'success',
                'admin.accountRemoved'
            );
        } catch (error) {
            this.showFetchStatus(status, error, 'admin.accountFailed');
        }
    }

    // ---- Improvement rounds ------------------------------------------------------------

    async loadRounds(selectId = null) {
        const status = document.getElementById('adminStatus');
        try {
            const response = await fetch(this.apiUrl('admin/rounds'), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.roundsFailed'));
            }
            this.adminRounds = body.rounds || [];
            this.openRoundId = body.open_round_id || null;
            this.renderRounds();
            const target =
                selectId ||
                this.adminRound?.id ||
                this.openRoundId ||
                this.adminRounds[0]?.id ||
                null;
            if (target) {
                await this.openRound(target);
            } else {
                this.adminRound = null;
                document.getElementById('adminRoundDetail').hidden = true;
            }
        } catch (error) {
            this.adminRounds = [];
            this.renderRounds();
            this.showFetchStatus(status, error, 'admin.roundsFailed');
        }
    }

    renderRounds() {
        const list = document.getElementById('adminRoundsList');
        list.replaceChildren();
        document.getElementById('adminRoundsCount').textContent = String(this.adminRounds.length);
        if (!this.adminRounds.length) {
            const empty = document.createElement('p');
            empty.className = 'admin-empty';
            empty.textContent = i18n.t('admin.roundsEmpty');
            list.append(empty);
            return;
        }
        this.adminRounds.forEach(round => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'admin-feedback-item';
            if (round.id === this.adminRound?.id) {
                button.classList.add('is-active');
            }
            const title = document.createElement('strong');
            title.textContent = round.name;
            const meta = document.createElement('span');
            meta.textContent = `${round.item_count} · ${this.formatMoment(round.created_at)}`;
            const state = document.createElement('small');
            state.textContent = i18n.t(
                round.status === 'closed' ? 'admin.roundStatusClosed' : 'admin.roundStatusOpen'
            );
            button.append(title, meta, state);
            button.addEventListener('click', () => void this.openRound(round.id));
            list.append(button);
        });
    }

    async openRound(roundId) {
        const status = document.getElementById('adminStatus');
        try {
            const response = await fetch(this.apiUrl(`admin/rounds/${roundId}`), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.roundsFailed'));
            }
            this.adminRound = body.round;
            this.renderRounds();
            this.renderRoundDetail();
        } catch (error) {
            this.showFetchStatus(status, error, 'admin.roundsFailed');
        }
    }

    renderRoundDetail() {
        const detail = document.getElementById('adminRoundDetail');
        if (!this.adminRound) {
            detail.hidden = true;
            return;
        }
        const round = this.adminRound;
        const closed = round.status === 'closed';
        detail.hidden = false;
        document.getElementById('adminRoundName').textContent = round.name;
        document.getElementById('adminRoundCreated').textContent =
            `${i18n.t(closed ? 'admin.roundClosedBy' : 'admin.roundOpenedBy')} ` +
            `${(closed ? round.closed_by : round.created_by) || '—'} · ` +
            `${this.formatMoment(closed ? round.closed_at : round.created_at)}`;
        document.getElementById('adminRoundStatus').textContent = i18n.t(
            closed ? 'admin.roundStatusClosed' : 'admin.roundStatusOpen'
        );
        const note = document.getElementById('adminRoundNote');
        note.value = round.note || '';
        note.disabled = closed;
        document.getElementById('adminRoundClose').disabled = closed;

        const items = document.getElementById('adminRoundItems');
        items.replaceChildren();
        if (!round.items?.length) {
            const empty = document.createElement('p');
            empty.className = 'admin-empty';
            empty.textContent = i18n.t('admin.roundEmpty');
            items.append(empty);
            return;
        }
        round.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'admin-round-item';
            const label = document.createElement('span');
            if (item.missing) {
                label.textContent = i18n.t('admin.roundMissing');
                row.classList.add('is-missing');
            } else {
                const pages = (item.pages || []).map(page => Number(page) + 1).join(', ');
                label.textContent =
                    `${item.original_name || i18n.t('admin.unnamedDocument')} · ` +
                    `${item.account_username || i18n.t('admin.unknownUser')} · ` +
                    `${i18n.t('admin.page')} ${pages || '—'}`;
            }
            row.append(label);
            if (!closed) {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'text-button danger-text';
                remove.textContent = i18n.t('admin.roundRemove');
                remove.addEventListener('click', () => void this.removeFromRound(item.id));
                row.append(remove);
            }
            items.append(row);
        });
    }

    async createRound(event) {
        event.preventDefault();
        const status = document.getElementById('adminStatus');
        const field = document.getElementById('roundName');
        const name = field.value.trim();
        if (!name) {
            return;
        }
        try {
            const response = await fetch(this.apiUrl('admin/rounds'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                const key = response.status === 409 ? 'admin.roundOpenExists' : 'admin.roundFailed';
                throw new Error(i18n.t(key) || body.detail);
            }
            field.value = '';
            this.adminRound = null;
            await this.loadRounds(body.round.id);
            this.showStatus(status, i18n.t('admin.roundCreated'), 'success', 'admin.roundCreated');
        } catch (error) {
            this.showFetchStatus(status, error, 'admin.roundFailed');
        }
    }

    async removeFromRound(feedbackId) {
        if (!this.adminRound) {
            return;
        }
        const status = document.getElementById('adminStatus');
        try {
            const response = await fetch(this.apiUrl(`admin/rounds/${this.adminRound.id}/items`), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback_id: feedbackId, include: false })
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.roundFailed'));
            }
            this.adminRound = body.round;
            this.renderRoundDetail();
            await this.loadRounds(this.adminRound.id);
            this.showStatus(status, i18n.t('admin.roundRemoved'), 'success', 'admin.roundRemoved');
        } catch (error) {
            this.showFetchStatus(status, error, 'admin.roundFailed');
        }
    }

    async closeRound() {
        if (!this.adminRound || !window.confirm(i18n.t('admin.roundConfirmClose'))) {
            return;
        }
        const status = document.getElementById('adminStatus');
        const button = document.getElementById('adminRoundClose');
        button.disabled = true;
        try {
            const response = await fetch(this.apiUrl(`admin/rounds/${this.adminRound.id}/close`), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    note: document.getElementById('adminRoundNote').value.trim()
                })
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('admin.roundFailed'));
            }
            await this.loadRounds(body.round.id);
            this.showStatus(status, i18n.t('admin.roundClosed'), 'success', 'admin.roundClosed');
        } catch (error) {
            this.showFetchStatus(status, error, 'admin.roundFailed');
        } finally {
            // A closed round keeps the button disabled; only a failure hands it back.
            button.disabled = this.adminRound?.status === 'closed';
        }
    }

    bindUpload() {
        const form = document.getElementById('uploadForm');
        const input = document.getElementById('pdfFile');
        const dropzone = document.getElementById('dropzone');

        form.addEventListener('submit', event => this.submitPdf(event));
        input.addEventListener('change', () => this.showSelectedFile());

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                dropzone.classList.add('is-dragging');
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                dropzone.classList.remove('is-dragging');
            });
        });
        dropzone.addEventListener('drop', event => {
            const dropped = [...(event.dataTransfer?.files || [])];
            if (!dropped.length) {
                return;
            }
            const transfer = new DataTransfer();
            dropped.forEach(file => transfer.items.add(file));
            input.files = transfer.files;
            this.showSelectedFile();
        });

        document.getElementById('tryAgain').addEventListener('click', () => this.returnToUpload());
    }

    showSelectedFile() {
        const files = [...document.getElementById('pdfFile').files];
        const label = document.getElementById('fileName');
        if (!files.length) {
            label.textContent = i18n.t('upload.dropHint');
            return;
        }
        if (files.length === 1) {
            label.textContent = `${files[0].name} · ${this.formatBytes(files[0].size)}`;
            return;
        }
        const total = files.reduce((sum, file) => sum + file.size, 0);
        label.textContent = `${i18n
            .t('upload.filesChosen')
            .replace('{count}', String(files.length))} · ${this.formatBytes(total)}`;
    }

    formatBytes(bytes) {
        if (bytes < 1024 * 1024) {
            return `${Math.ceil(bytes / 1024)} KB`;
        }
        if (bytes < 1024 * 1024 * 1024) {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    async submitPdf(event) {
        event.preventDefault();
        const files = [...document.getElementById('pdfFile').files];
        const status = document.getElementById('uploadStatus');
        if (
            !files.length ||
            files.some(
                file => !file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf'
            )
        ) {
            this.showStatus(status, i18n.t('messages.choosePdf'), 'error');
            return;
        }
        if (files.some(file => file.size > MAX_UPLOAD_BYTES)) {
            this.showStatus(status, i18n.t('messages.fileTooLarge'), 'error');
            return;
        }

        // An empty page field is a request, not an omission: sweep the document.
        const notation = document.getElementById('pageNumbers').value.trim();
        let pages = [];
        if (notation) {
            try {
                pages = parsePageSelection(notation);
            } catch {
                this.showStatus(status, i18n.t('messages.invalidPage'), 'error');
                return;
            }
        }

        this.setUploadBusy(true);
        if (files.length === 1) {
            this.showOnly('processing');
            document.getElementById('processingStage').textContent = i18n.t('processing.uploading');
        }

        try {
            const created = [];
            for (const file of files) {
                created.push(await this.createJob(file, pages));
            }
            document.getElementById('pdfFile').value = '';
            this.showSelectedFile();
            if (created.length === 1) {
                this.job = created[0];
                await this.pollJob(created[0].id);
                return;
            }
            // A batch has no single result to show, so hand the owner the queue instead.
            await this.openOwnJobs();
            this.showStatus(
                document.getElementById('jobsStatus'),
                i18n.t('jobs.queued').replace('{count}', String(created.length)),
                'success'
            );
        } catch (error) {
            this.returnToUpload();
            this.showStatus(
                status,
                localizedFetchError(error, i18n.t('messages.serviceUnavailable')),
                'error'
            );
        } finally {
            this.setUploadBusy(false);
        }
    }

    async createJob(file, pages) {
        const form = new FormData();
        form.append('file', file);
        if (pages.length) {
            form.append('pages', pages.join(','));
        }
        form.append('convention', document.getElementById('convention').value);
        form.append('consent_learning', String(document.getElementById('trainingConsent').checked));
        const response = await fetch(this.apiUrl('jobs'), {
            method: 'POST',
            credentials: 'include',
            body: form
        });
        const body = await this.readResponse(response);
        if (!response.ok) {
            throw new Error(body.detail || i18n.t('messages.uploadFailed'));
        }
        return body;
    }

    async readResponse(response) {
        const text = await response.text();
        if (!text) {
            return {};
        }
        try {
            return JSON.parse(text);
        } catch {
            return { detail: text };
        }
    }

    setUploadBusy(busy) {
        const button = document.getElementById('paintButton');
        button.disabled = busy;
        button.querySelector('span').textContent = i18n.t(
            busy ? 'upload.submitting' : 'upload.submit'
        );
    }

    async pollJob(jobId) {
        const token = ++this.pollToken;
        while (token === this.pollToken) {
            const response = await fetch(this.apiUrl(`jobs/${jobId}`), {
                credentials: 'include',
                cache: 'no-store'
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('messages.statusFailed'));
            }
            this.job = body;
            this.updateProcessingStage(body.stage);
            if (body.status === 'queued' && body.queue_position > 0) {
                document.getElementById('processingStage').textContent = i18n
                    .t('processing.queuePosition')
                    .replace('{position}', String(body.queue_position));
            } else if (body.stage === 'scanning-document' && body.page_count) {
                document.getElementById('processingStage').textContent +=
                    ` · ${body.scanned_pages || 0}/${body.page_count}`;
            } else if (body.current_page !== null && body.current_page !== undefined) {
                document.getElementById('processingStage').textContent +=
                    ` · ${Number(body.completed_pages || 0) + 1}/${body.selected_page_count || 1}`;
            }
            if (TERMINAL_STATES.has(body.status)) {
                this.handleTerminalJob(body);
                return;
            }
            await new Promise(resolve => window.setTimeout(resolve, 1300));
        }
    }

    updateProcessingStage(stage) {
        const key = `processing.stages.${stage}`;
        const translated = i18n.t(key);
        document.getElementById('processingStage').textContent =
            translated === key ? i18n.t('processing.working') : translated;
    }

    handleTerminalJob(job) {
        if (job.status === 'ready' || job.status === 'revision-requested') {
            this.showReview(job);
            return;
        }
        if (job.status === 'declined') {
            this.showDeclined(job);
            return;
        }
        this.returnToUpload();
        this.showStatus(
            document.getElementById('uploadStatus'),
            i18n.t('messages.processingFailed'),
            'error'
        );
    }

    showReview(job) {
        this.showOnly('review');
        this.annotations = [];
        this.activeTool = null;
        this.pendingPoints = [];
        this.renderAnnotations();
        let pages = job.pages || [];
        if (!pages.length) {
            pages = [
                {
                    page: job.page,
                    page_number: Number(job.page) + 1,
                    status: 'painted',
                    convention: job.convention,
                    metrics: job.metrics || {},
                    preview_original: job.preview_original,
                    preview_painted: job.preview_painted
                }
            ];
        }
        const picker = document.getElementById('reviewPage');
        picker.replaceChildren();
        pages.forEach(item => {
            const option = document.createElement('option');
            option.value = String(item.page);
            option.textContent = this.pageOptionLabel(item);
            picker.append(option);
        });
        this.viewer.currentPage = pages[0].page;
        picker.value = String(this.viewer.currentPage);
        this.updateReviewPage(true);
    }

    pageOptionLabel(item) {
        const status = i18n.t(
            item.status === 'declined' ? 'review.pageUnchanged' : 'review.pagePainted'
        );
        return `${i18n.t('review.pageLabel')} ${item.page_number || Number(item.page) + 1} · ${status}`;
    }

    currentPageResult() {
        return (
            this.job?.pages?.find(item => item.page === this.viewer.currentPage) || {
                page: this.job?.page,
                status: 'painted',
                convention: this.job?.convention,
                metrics: this.job?.metrics || {},
                preview_original: this.job?.preview_original,
                preview_painted: this.job?.preview_painted
            }
        );
    }

    updateReviewPage(reset = true) {
        const result = this.currentPageResult();
        const metrics = result.metrics || {};
        document.getElementById('metricCoverage').textContent =
            `${Math.round((metrics.paint_rate || 0) * 100)}%`;
        document.getElementById('metricRuns').textContent =
            `${metrics.runs_painted || 0}/${metrics.runs || 0}`;
        document.getElementById('metricCodes').textContent =
            (metrics.codes || []).join(', ') || '—';
        document.getElementById('metricAbstentions').textContent = String(metrics.abstentions || 0);
        document.getElementById('summaryConvention').textContent = this.conventionLabel(
            result.convention || this.job.convention
        );
        document.getElementById('downloadPdf').href = this.apiUrl(this.job.download);
        this.viewer.currentView = 'painted';
        this.updateViewButtons();
        this.pendingPoints = [];
        this.loadDiagram(this.apiUrl(result.preview_painted), reset);
    }

    showDeclined(job) {
        this.showOnly('declined');
        document.getElementById('declineReason').textContent =
            (job.stage === 'no-wiring-page' ? i18n.t('messages.noWiringPage') : '') ||
            job.decline_reason ||
            (job.stage === 'confirm-colour-convention'
                ? i18n.t('declined.conventionAmbiguous')
                : i18n.t('declined.unsupported'));
        if (job.stage === 'confirm-colour-convention' && job.convention) {
            document.getElementById('convention').value = job.convention;
        }
    }

    conventionLabel(value) {
        const key = {
            auto: 'upload.conventionAuto',
            iec_two_letter: 'upload.conventionIec',
            volvo_classic: 'upload.conventionVolvo'
        }[value];
        return key ? i18n.t(key) : value || '—';
    }

    showOnly(name) {
        document.getElementById('accessPanel').hidden = name !== 'access';
        document.getElementById('accountPanel').hidden = name !== 'account';
        document.getElementById('uploadPanel').hidden = name !== 'upload';
        document.getElementById('processingPanel').hidden = name !== 'processing';
        document.getElementById('reviewPanel').hidden = name !== 'review';
        document.getElementById('declinedPanel').hidden = name !== 'declined';
        document.getElementById('jobsPanel').hidden = name !== 'jobs';
        document.getElementById('adminPanel').hidden = name !== 'admin';
        document.getElementById('accountBar').hidden =
            !this.account || ['access', 'account'].includes(name);
    }

    returnToUpload() {
        this.pollToken += 1;
        this.showOnly('upload');
        document
            .getElementById('uploadPanel')
            .scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    bindViewer() {
        document.getElementById('reviewPage').addEventListener('change', event => {
            this.viewer.currentPage = Number(event.target.value);
            this.updateReviewPage(true);
            this.renderAnnotations();
        });
        document
            .getElementById('showPainted')
            .addEventListener('click', () => this.switchView('painted'));
        document
            .getElementById('showOriginal')
            .addEventListener('click', () => this.switchView('original'));
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomBy(1.22));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomBy(1 / 1.22));
        document.getElementById('zoomFit').addEventListener('click', () => this.fitDiagram());

        const viewport = document.getElementById('diagramViewport');
        viewport.addEventListener('wheel', event => this.onWheel(event), {
            passive: false
        });
        viewport.addEventListener('pointerdown', event => this.onPointerDown(event));
        viewport.addEventListener('pointermove', event => this.onPointerMove(event));
        viewport.addEventListener('pointerup', event => this.onPointerUp(event));
        viewport.addEventListener('pointercancel', () => this.cancelPointer());
        window.addEventListener('resize', () => {
            if (!document.getElementById('reviewPanel').hidden) {
                this.fitDiagram();
            }
        });
    }

    switchView(view) {
        if (!this.job) {
            return;
        }
        this.viewer.currentView = view;
        this.updateViewButtons();
        const result = this.currentPageResult();
        const path = view === 'painted' ? result.preview_painted : result.preview_original;
        this.loadDiagram(this.apiUrl(path), false);
    }

    updateViewButtons() {
        const painted = this.viewer.currentView === 'painted';
        document.getElementById('showPainted').classList.toggle('active', painted);
        document.getElementById('showPainted').setAttribute('aria-pressed', String(painted));
        document.getElementById('showOriginal').classList.toggle('active', !painted);
        document.getElementById('showOriginal').setAttribute('aria-pressed', String(!painted));
    }

    loadDiagram(url, reset = true) {
        const image = document.getElementById('diagramImage');
        image.onload = () => {
            const plane = document.getElementById('diagramPlane');
            this.viewer.width = image.naturalWidth;
            this.viewer.height = image.naturalHeight;
            plane.style.width = `${this.viewer.width}px`;
            plane.style.height = `${this.viewer.height}px`;
            if (reset) {
                this.fitDiagram();
            }
            this.renderAnnotations();
        };
        image.src = url;
    }

    fitDiagram() {
        if (!this.viewer.width || !this.viewer.height) {
            return;
        }
        const viewport = document.getElementById('diagramViewport');
        const padding = 34;
        this.viewer.scale = Math.min(
            (viewport.clientWidth - padding) / this.viewer.width,
            (viewport.clientHeight - padding) / this.viewer.height
        );
        this.viewer.scale = Math.max(0.03, this.viewer.scale);
        this.viewer.offsetX = (viewport.clientWidth - this.viewer.width * this.viewer.scale) / 2;
        this.viewer.offsetY = (viewport.clientHeight - this.viewer.height * this.viewer.scale) / 2;
        this.applyTransform();
    }

    zoomBy(factor, clientX = null, clientY = null) {
        const viewport = document.getElementById('diagramViewport');
        const rect = viewport.getBoundingClientRect();
        const focusX = clientX === null ? viewport.clientWidth / 2 : clientX - rect.left;
        const focusY = clientY === null ? viewport.clientHeight / 2 : clientY - rect.top;
        const next = Math.min(12, Math.max(0.025, this.viewer.scale * factor));
        const ratio = next / this.viewer.scale;
        this.viewer.offsetX = focusX - (focusX - this.viewer.offsetX) * ratio;
        this.viewer.offsetY = focusY - (focusY - this.viewer.offsetY) * ratio;
        this.viewer.scale = next;
        this.applyTransform();
    }

    onWheel(event) {
        event.preventDefault();
        this.zoomBy(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    }

    onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }
        const viewport = document.getElementById('diagramViewport');
        if (this.activeTool) {
            viewport.setPointerCapture(event.pointerId);
            this.viewer.dragging = {
                marking: true,
                x: event.clientX,
                y: event.clientY
            };
            return;
        }
        this.viewer.dragging = {
            marking: false,
            x: event.clientX,
            y: event.clientY,
            offsetX: this.viewer.offsetX,
            offsetY: this.viewer.offsetY,
            moved: false
        };
        viewport.classList.add('is-panning');
        viewport.setPointerCapture(event.pointerId);
    }

    onPointerMove(event) {
        const drag = this.viewer.dragging;
        if (!drag || drag.marking) {
            return;
        }
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
            drag.moved = true;
        }
        this.viewer.offsetX = drag.offsetX + dx;
        this.viewer.offsetY = drag.offsetY + dy;
        this.applyTransform();
    }

    onPointerUp(event) {
        const drag = this.viewer.dragging;
        this.cancelPointer();
        if (!drag?.marking) {
            return;
        }
        this.markAt(event.clientX, event.clientY);
    }

    cancelPointer() {
        this.viewer.dragging = null;
        document.getElementById('diagramViewport').classList.remove('is-panning');
    }

    applyTransform() {
        document.getElementById('diagramPlane').style.transform =
            `translate(${this.viewer.offsetX}px, ${this.viewer.offsetY}px) scale(${this.viewer.scale})`;
        document.querySelectorAll('.annotation-marker').forEach(marker => {
            marker.style.transform = `translate(-50%, -50%) scale(${1 / this.viewer.scale})`;
        });
        document.querySelectorAll('.annotation-segment').forEach(segment => {
            segment.style.height = `${4 / this.viewer.scale}px`;
        });
    }

    bindFeedback() {
        document.getElementById('errorTools').addEventListener('click', event => {
            const button = event.target.closest('button[data-error]');
            if (!button) {
                return;
            }
            let next = null;
            if (this.activeTool?.type !== button.dataset.error) {
                next = {
                    type: button.dataset.error,
                    geometry: button.dataset.geometry
                };
            }
            this.activeTool = next;
            this.pendingPoints = [];
            document.querySelectorAll('#errorTools button').forEach(item => {
                item.classList.toggle('active', next && item === button);
                item.setAttribute('aria-pressed', String(Boolean(next && item === button)));
            });
            document.getElementById('expectedCodeGroup').hidden = next?.type !== 'wrong-colour';
            document
                .getElementById('diagramViewport')
                .classList.toggle('is-marking', Boolean(next));
            this.updateViewerHint();
        });
        document
            .getElementById('submitFeedback')
            .addEventListener('click', () => this.submitFeedback());
        document.getElementById('deleteJob').addEventListener('click', () => this.deleteJob());
    }

    updateViewerHint() {
        const hint = document.getElementById('viewerHint');
        if (!this.activeTool) {
            hint.textContent = i18n.t('review.viewerHint');
        } else if (this.activeTool.geometry === 'segment') {
            const key = this.pendingPoints.length
                ? 'feedback.secondPointHint'
                : 'feedback.firstPointHint';
            hint.textContent = i18n.t(key);
        } else {
            hint.textContent = i18n.t('feedback.pointHint');
        }
    }

    markAt(clientX, clientY) {
        if (!this.activeTool || !this.viewer.width || !this.viewer.height) {
            return;
        }
        if (this.activeTool.type === 'wrong-colour') {
            const expected = this.expectedCode();
            if (!expected) {
                this.showStatus(
                    document.getElementById('feedbackStatus'),
                    i18n.t('messages.expectedCodeRequired'),
                    'error'
                );
                document.getElementById('expectedCode').focus();
                return;
            }
        }
        const viewportRect = document.getElementById('diagramViewport').getBoundingClientRect();
        const x =
            (clientX - viewportRect.left - this.viewer.offsetX) /
            this.viewer.scale /
            this.viewer.width;
        const y =
            (clientY - viewportRect.top - this.viewer.offsetY) /
            this.viewer.scale /
            this.viewer.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) {
            return;
        }

        this.pendingPoints.push([Number(x.toFixed(6)), Number(y.toFixed(6))]);
        const required = this.activeTool.geometry === 'segment' ? 2 : 1;
        if (this.pendingPoints.length < required) {
            this.renderAnnotations();
            this.updateViewerHint();
            return;
        }
        this.annotations.push({
            page: this.viewer.currentPage,
            type: this.activeTool.type,
            geometry: {
                type: this.activeTool.geometry,
                points: [...this.pendingPoints]
            },
            expected_code: this.activeTool.type === 'wrong-colour' ? this.expectedCode() : null
        });
        this.pendingPoints = [];
        this.renderAnnotations();
        this.updateViewerHint();
    }

    expectedCode() {
        const value = document
            .getElementById('expectedCode')
            .value.trim()
            .toUpperCase()
            .replace(/\s+/g, '');
        return /^[A-Z]{1,3}(?:\/[A-Z]{1,3})?$/.test(value) ? value : '';
    }

    renderAnnotations() {
        const layer = document.getElementById('annotationLayer');
        layer.replaceChildren();
        this.annotations
            .filter(annotation => annotation.page === this.viewer.currentPage)
            .forEach((annotation, index) => {
                this.renderOneAnnotation(layer, annotation, index + 1);
            });
        if (this.pendingPoints.length) {
            this.renderOneAnnotation(
                layer,
                {
                    type: this.activeTool.type,
                    geometry: { type: 'point', points: this.pendingPoints }
                },
                '•'
            );
        }
        this.renderAnnotationList();
        this.applyTransform();
    }

    renderOneAnnotation(layer, annotation, label) {
        const points = annotation.geometry.points;
        points.forEach((point, pointIndex) => {
            const marker = document.createElement('span');
            marker.className = `annotation-marker marker-${annotation.type}`;
            marker.style.left = `${point[0] * this.viewer.width}px`;
            marker.style.top = `${point[1] * this.viewer.height}px`;
            marker.textContent = points.length === 1 ? label : `${label}.${pointIndex + 1}`;
            layer.append(marker);
        });
        if (annotation.geometry.type === 'segment' && points.length === 2) {
            const [a, b] = points;
            const x1 = a[0] * this.viewer.width;
            const y1 = a[1] * this.viewer.height;
            const x2 = b[0] * this.viewer.width;
            const y2 = b[1] * this.viewer.height;
            const segment = document.createElement('span');
            const length = Math.hypot(x2 - x1, y2 - y1);
            const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            segment.className = `annotation-segment marker-${annotation.type}`;
            segment.style.left = `${x1}px`;
            segment.style.top = `${y1}px`;
            segment.style.width = `${length}px`;
            segment.style.transform = `rotate(${angle}deg)`;
            layer.append(segment);
        }
    }

    renderAnnotationList() {
        const list = document.getElementById('annotationList');
        list.replaceChildren();
        this.annotations.forEach((annotation, index) => {
            const row = document.createElement('div');
            row.className = 'annotation-row';
            const swatch = document.createElement('span');
            swatch.className = `error-swatch ${this.swatchClass(annotation.type)}`;
            const text = document.createElement('span');
            const expected = annotation.expected_code ? ` · ${annotation.expected_code}` : '';
            const page = `${i18n.t('review.pageLabel')} ${Number(annotation.page) + 1}`;
            text.textContent = `${index + 1}. ${page} · ${i18n.t(ERROR_LABEL_KEYS[annotation.type])}${expected}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '×';
            remove.setAttribute('aria-label', i18n.t('aria.removeAnnotation'));
            remove.addEventListener('click', () => {
                this.annotations.splice(index, 1);
                this.renderAnnotations();
            });
            row.append(swatch, text, remove);
            list.append(row);
        });
        document.getElementById('annotationCount').textContent = String(this.annotations.length);
        document.getElementById('submitFeedback').disabled = this.annotations.length === 0;
    }

    swatchClass(type) {
        return {
            'wrong-colour': 'wrong',
            'non-wire': 'nonwire',
            missing: 'missing',
            'stops-mid': 'stops',
            bleed: 'bleed',
            'dash-style': 'dash',
            'stripe-style': 'stripe'
        }[type];
    }

    async submitFeedback() {
        if (!this.job || !this.annotations.length) {
            return;
        }
        const button = document.getElementById('submitFeedback');
        const status = document.getElementById('feedbackStatus');
        button.disabled = true;
        button.textContent = i18n.t('feedback.submitting');
        try {
            const response = await fetch(this.apiUrl(`jobs/${this.job.id}/feedback`), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    annotations: this.annotations,
                    note: document.getElementById('feedbackNote').value.trim(),
                    request_revision: document.getElementById('requestRevision').checked,
                    consent_learning: document.getElementById('trainingConsent').checked
                })
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('messages.feedbackFailed'));
            }
            this.showStatus(status, i18n.t('messages.feedbackAccepted'), 'success');
            this.annotations = [];
            this.pendingPoints = [];
            this.renderAnnotations();
        } catch (error) {
            this.showStatus(
                status,
                localizedFetchError(error, i18n.t('messages.feedbackFailed')),
                'error'
            );
        } finally {
            button.textContent = i18n.t('feedback.submit');
            button.disabled = this.annotations.length === 0;
        }
    }

    async deleteJob() {
        if (!this.job || !window.confirm(i18n.t('messages.confirmDelete'))) {
            return;
        }
        const response = await fetch(this.apiUrl(`jobs/${this.job.id}`), {
            method: 'DELETE',
            credentials: 'include'
        });
        if (response.ok) {
            this.job = null;
            this.annotations = [];
            document.getElementById('pdfFile').value = '';
            this.showSelectedFile();
            this.returnToUpload();
            this.showStatus(
                document.getElementById('uploadStatus'),
                i18n.t('messages.jobDeleted'),
                'success'
            );
        }
    }

    showStatus(element, message, type, translationKey = '') {
        element.hidden = false;
        element.className = `inline-status ${type}`;
        element.textContent = message;
        if (translationKey) {
            element.dataset.statusI18n = translationKey;
        } else {
            delete element.dataset.statusI18n;
        }
    }

    showFetchStatus(element, error, translationKey) {
        const fallback = i18n.t(translationKey);
        const message = localizedFetchError(error, fallback);
        this.showStatus(element, message, 'error', message === fallback ? translationKey : '');
    }

    updateLanguage() {
        document.title = `${i18n.t('hero.title')} beta — Engenharia NATA`;
        document.querySelectorAll('[data-status-i18n]').forEach(status => {
            status.textContent = i18n.t(status.dataset.statusI18n);
        });
        const image = document.getElementById('diagramImage');
        if (image) {
            image.alt = i18n.t('review.imageAlt');
        }
        if (this.job?.convention) {
            document.querySelectorAll('#reviewPage option').forEach(option => {
                const result = this.job.pages?.find(item => String(item.page) === option.value);
                if (result) {
                    option.textContent = this.pageOptionLabel(result);
                }
            });
            document.getElementById('summaryConvention').textContent = this.conventionLabel(
                this.currentPageResult().convention || this.job.convention
            );
        }
        this.updateViewerHint();
        this.renderAnnotationList();
        this.setUploadBusy(document.getElementById('paintButton')?.disabled || false);
        if (this.account) {
            document.getElementById('accountName').textContent = this.account.username;
            document.getElementById('openAdmin').hidden = this.account.role !== 'admin';
        }
        if (this.jobs.length) {
            this.renderOwnJobs();
        }
        if (this.adminAccounts.length) {
            this.renderAccounts();
        }
        if (this.adminRounds.length) {
            this.renderRounds();
            this.renderRoundDetail();
        }
        if (this.adminFeedback.length) {
            this.renderAdminQueue();
        }
        if (this.adminReport) {
            this.renderAdminAnnotations();
            document.getElementById('adminFeedbackStatus').textContent = this.feedbackStatusLabel(
                this.adminReport.status
            );
        }
    }
}

const app = new PintorApp();
app.inicializar();

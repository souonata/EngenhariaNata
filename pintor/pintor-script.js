/**
 * Pintor web beta: private PDF jobs, conservative result viewer, and typed expert-review evidence.
 */

import { App, i18n } from '../src/core/app.js';
import { localizedFetchError } from './pintor-network.js';

const TERMINAL_STATES = new Set(['ready', 'declined', 'failed', 'revision-requested']);
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
                this.showOnly('upload');
            }
        } catch (error) {
            this.showStatus(
                status,
                localizedFetchError(error, i18n.t('access.unavailable')),
                'error'
            );
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
            this.showOnly('upload');
        } catch (error) {
            this.showStatus(
                status,
                localizedFetchError(error, i18n.t('access.unavailable')),
                'error'
            );
        } finally {
            button.disabled = false;
            button.querySelector('span').textContent = i18n.t('access.submit');
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
            const file = event.dataTransfer?.files?.[0];
            if (!file) {
                return;
            }
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
            this.showSelectedFile();
        });

        document.getElementById('tryAgain').addEventListener('click', () => this.returnToUpload());
    }

    showSelectedFile() {
        const file = document.getElementById('pdfFile').files[0];
        document.getElementById('fileName').textContent = file
            ? `${file.name} · ${this.formatBytes(file.size)}`
            : i18n.t('upload.dropHint');
    }

    formatBytes(bytes) {
        if (bytes < 1024 * 1024) {
            return `${Math.ceil(bytes / 1024)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async submitPdf(event) {
        event.preventDefault();
        const file = document.getElementById('pdfFile').files[0];
        const status = document.getElementById('uploadStatus');
        if (
            !file ||
            (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')
        ) {
            this.showStatus(status, i18n.t('messages.choosePdf'), 'error');
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            this.showStatus(status, i18n.t('messages.fileTooLarge'), 'error');
            return;
        }

        const page = Number(document.getElementById('pageNumber').value);
        if (!Number.isInteger(page) || page < 1 || page > 50) {
            this.showStatus(status, i18n.t('messages.invalidPage'), 'error');
            return;
        }

        this.setUploadBusy(true);
        this.showOnly('processing');
        document.getElementById('processingStage').textContent = i18n.t('processing.uploading');
        const form = new FormData();
        form.append('file', file);
        form.append('page', String(page - 1));
        form.append('convention', document.getElementById('convention').value);
        form.append('consent_learning', String(document.getElementById('trainingConsent').checked));

        try {
            const response = await fetch(this.apiUrl('jobs'), {
                method: 'POST',
                credentials: 'include',
                body: form
            });
            const body = await this.readResponse(response);
            if (!response.ok) {
                throw new Error(body.detail || i18n.t('messages.uploadFailed'));
            }
            this.job = body;
            await this.pollJob(body.id);
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
        const metrics = job.metrics || {};
        document.getElementById('metricCoverage').textContent =
            `${Math.round((metrics.paint_rate || 0) * 100)}%`;
        document.getElementById('metricRuns').textContent =
            `${metrics.runs_painted || 0}/${metrics.runs || 0}`;
        document.getElementById('metricCodes').textContent =
            (metrics.codes || []).join(', ') || '—';
        document.getElementById('metricAbstentions').textContent = String(metrics.abstentions || 0);
        document.getElementById('summaryConvention').textContent = this.conventionLabel(
            job.convention
        );
        document.getElementById('downloadPdf').href = this.apiUrl(job.download);
        this.viewer.currentView = 'painted';
        this.updateViewButtons();
        this.loadDiagram(this.apiUrl(job.preview_painted));
    }

    showDeclined(job) {
        this.showOnly('declined');
        document.getElementById('declineReason').textContent =
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
        document.getElementById('uploadPanel').hidden = name !== 'upload';
        document.getElementById('processingPanel').hidden = name !== 'processing';
        document.getElementById('reviewPanel').hidden = name !== 'review';
        document.getElementById('declinedPanel').hidden = name !== 'declined';
    }

    returnToUpload() {
        this.pollToken += 1;
        this.showOnly('upload');
        document
            .getElementById('uploadPanel')
            .scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    bindViewer() {
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
        const path = view === 'painted' ? this.job.preview_painted : this.job.preview_original;
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
        this.annotations.forEach((annotation, index) => {
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
            text.textContent = `${index + 1}. ${i18n.t(ERROR_LABEL_KEYS[annotation.type])}${expected}`;
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

    showStatus(element, message, type) {
        element.hidden = false;
        element.className = `inline-status ${type}`;
        element.textContent = message;
    }

    updateLanguage() {
        document.title = `${i18n.t('hero.title')} beta — Engenharia NATA`;
        const image = document.getElementById('diagramImage');
        if (image) {
            image.alt = i18n.t('review.imageAlt');
        }
        if (this.job?.convention) {
            document.getElementById('summaryConvention').textContent = this.conventionLabel(
                this.job.convention
            );
        }
        this.updateViewerHint();
        this.renderAnnotationList();
        this.setUploadBusy(document.getElementById('paintButton')?.disabled || false);
    }
}

const app = new PintorApp();
app.inicializar();

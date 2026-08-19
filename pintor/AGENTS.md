# Pintor project instructions

- Treat Pintor as a standalone product. Do not import code, databases, configuration, or runtime
  state from the Volvo Penta Assistant.
- Keep code, comments, documentation, UI strings, and commit messages in English.
- Preserve source PDFs. All painting must be an additive output or removable PDF overlay.
- Prefer precision over recall. Ambiguous geometry must abstain and remain available for review.
- Learn general rules from annotations; never encode publication IDs or marked coordinates as fixes.
- Split training, validation, and lockbox data by publication to prevent page-level leakage.
- Optimizers may tune policy/classifier parameters, but must not mutate topology or safety rules.
- Keep PDFs, markups, generated workspaces, databases, logs, and other private data out of Git.
- Update `HANDOFF.md` after meaningful work.

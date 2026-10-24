# Forms instructions

Follow root/package rules and the [form system](../../docs/FORM_SYSTEM.md).

Own generic typed React Hook Form bindings over shared UI. Preserve schema input/output types, field paths, refs, blur/change behavior, disabled values and nested error messages. Web owns domain schemas/defaults, submission, permissions, conflict handling and conditional sections.

JSON descriptors define presentation only. Reject unknown widgets/properties, unsafe/duplicate paths and ambiguous options; external JSON requires a trusted field-name allowlist. Never evaluate expressions or import arbitrary components from JSON. Preserve null/false/zero and unfinished numeric drafts. Test these behaviors through public controls and keep stable field-array IDs.

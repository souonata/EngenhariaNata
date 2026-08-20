# Pintor electrical safety rules

These rules define what the standalone beta may colour. They are product invariants, not tunable
model parameters. The system must prefer a black, reviewable conductor over a confidently wrong
colour.

## Supported evidence boundary

The beta accepts a vector or rasterized PDF page whose visible wire legends match a supported code
profile. Vector pages use exact strokes and text when available; image-only pages use OCR and pixel
topology. The colour convention is either selected by the user or detected from at least two
strong OCR observations with a decisive margin. It declines uncertain conventions, unsupported
notation, illegible legends, and ambiguous topology. A job paints one selected page while
preserving every other page in the PDF.

"Any wiring diagram" remains a product direction rather than permission to guess. A new colour
profile or symbol grammar becomes supported only after publication-grouped evaluation. Unknown or
unrecognised component geometry is a hard abstention boundary.

## Hard electrical and drawing invariants

1. **Electrical connectivity is not physical conductor identity.** A connected net may contain
   several physical wires and several colours. A splice, terminal, connector, switch, fuse,
   resistor, relay contact, or component pin is a possible colour boundary.
2. **Only unbranched physical continuation inherits colour.** Automatic propagation across a
   graph node is allowed only when exactly two conductor arcs form one unambiguous continuation.
   A node with three or more branches stays unresolved unless each branch has direct ownership
   evidence.
3. **Components are never bridges.** A short collinear gap may not be joined through a protected
   component or unknown symbol zone. A recognised line hop or drawing occlusion may become a
   bridge rule only after its own corpus and safety gate exist.
4. **Crossing lines do not connect by proximity alone.** A junction requires explicit drawing
   evidence such as a dot or a convention-specific junction symbol. A hop, gap, or plain crossing
   remains separate.
5. **A colour is never invented.** It must come from an exact, convention-valid printed legend.
   Conflicting labels, a weak convention match, or uncertain ownership causes abstention.
6. **Legend ownership follows the physical run.** Text proximity is evidence, not authority.
   Orientation, protected regions, graph route, wire identifier, and competing candidates must
   agree before a legend owns a conductor.
7. **Only conductor ink is paintable.** Text, component outlines, connector bodies, terminals,
   junction dots, frames, dimensions, hatching, and unknown furniture remain untouched.
8. **Visual semantics are preserved.** Dashed conductors remain dashed. A two-colour code keeps
   its base/tracer order. White conductors remain distinguishable from the page. If the renderer
   cannot express the source line style and colour code faithfully, the run stays black.
9. **The source is immutable.** Colour is a removable optional-content overlay. The source PDF
   bytes and all non-overlay drawing operators remain unchanged.
10. **No release without proof.** A result is downloadable only after the protected-region gate,
    source-preservation gate, successful reopen, and page-count check all pass. A failed result is
    quarantined.

## Learnable decisions

The following may be learned from expert-accepted, publication-grouped evidence: wire-versus-
furniture features, label-to-run ranking, drawing-scale priors, dash detection thresholds,
abstention thresholds, and convention selection scores. Learned decisions remain subordinate to
all hard invariants above.

The following may never be learned or optimised away: component boundaries, branch colour
boundaries, protected regions, source immutability, release gates, tenant isolation, consent, and
the requirement to abstain on conflicting evidence.

## Feedback routing

| Review type | Required geometry | Engineering task | Direct classifier label? |
| --- | --- | --- | --- |
| Non-wire painted | Point | Wire versus drawing furniture | Only after expert acceptance |
| Missing paint | Point | Tracing or abstention policy | No |
| Wrong colour | Point + expected code | Legend ownership/convention | No |
| Stops mid-wire | Segment | Physical continuation | No |
| Bleeds past boundary | Segment | Must-not-link topology boundary | No |
| Dashed wire became solid | Segment | Renderer line-style fidelity | No |
| Base/tracer stripe is wrong | Segment | Renderer base/tracer fidelity | No |

Public feedback is untrusted. It enters `pending` adjudication, never training. An expert may accept
or reject it, route it to the correct engineering task, assign a verified publication/revision
group (a document hash alone is not sufficient), and create an immutable dataset snapshot.
Promotion then requires publication-grouped cross-validation, a previously untouched lockbox, zero
new protected-region regressions, and an explicit signed/versioned model decision.

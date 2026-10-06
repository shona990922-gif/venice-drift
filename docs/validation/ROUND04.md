# Round 04 — Experience polish

Validated in the actual Chromium in-app browser at 1280×720 and 390×844.

- Minimal entry and three permanent controls: Sound, Quality, Fullscreen. Look hint fades after 4.2 seconds. No steering controls or automatic recentering.
- CC0 Venice water and city field recordings, CC0 birds, original synthesized bell/wood accents. Lazy user-gesture audio activation; bridge enclosure and section gains crossfade. Muting measured zero output RMS; playback measured nonzero RMS and no load errors. No microphone is used.
- Sound recording `qa/journey-clip-1791312645841.webm`: 11.97 seconds, VP9 and Opus, 1280×720. Audio analysis: mean −43.5 dB, maximum −17.1 dB, no clipping. This is signal validation, not a claim of a separate listening-panel review.
- Touch event test `qa/touch-qa-1791312994232.json`: yaw −0.7504 rad, pitch +0.3411 rad, boat advanced 2.3484 m independently, no recentering. This uses browser-dispatched touch PointerEvents, not a physical phone.
- Camera inherits only 25% of centimetre-scale heave (16% for coarse-pointer devices), no boat roll. Boat visual motion remains separate.
- At route end: 3-second fade out, reset while fully covered, 4-second fade in. Fade is included in the final render and canvas recordings. `qa/journey-clip-1791313555720.webm` verifies this; loop counter incremented and navigation resumed. Terminal façades now include windows, cornices and doors rather than close grey boxes.

Audio provenance and derivative processing are recorded in `public/licenses/audio.json`. Physical handset and Safari checks remain for final platform QA; no such results are implied here.

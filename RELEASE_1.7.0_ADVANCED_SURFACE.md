# UI Studio Mixer 1.7.0 — Advanced Surface Engine candidate

Base: tested v1.6.0 Surface Editor, commit 731a719db01325505506929846b13b54558733c7. The v1.6.0 CI run 43420424698 completed Linux build, regression, real browser canvas/PSD/IndexedDB tests and Intel Mac packaging. The actual destination Mac has not been verified.

## New workflow

- Open a GLB, select a material, and open Texture Canvas. Use the Material canvas selector in the top bar to open or switch to another material. Existing canvases stay applied in 3D; each has its own native editable layer document. The active material and all opened documents save together in the local library.
- Save editable project or Send Back to Product Studio as before. Legacy v1.6 single-document projects reopen with the same workflow. Draft autosave after the initial save retains all opened material documents; explicitly save again to update the baked GLB.
- Close/restore restores all original materials; do not close before saving. Original comparison in the active canvas must be switched back to edited preview before saving or switching materials. Undo history is local to the currently mounted panel and resets on material switch, but its committed layers stay intact.
- Memory is bounded to eight active documents and approximately 320 MiB of estimated canvas backing buffers (not a guarantee of total process/GPU memory). Full-resolution 4096px square textures can consume the entire estimated budget; use smaller textures for multi-material work on Intel hardware.

## Optional local AI texture provider

The adapter uses the AUTOMATIC1111 Stable Diffusion WebUI API, with an explicitly configured loopback address. It supports:
- Prompt-to-texture generation (txt2img).
- Reference or current-texture matching (img2img).
- Inpainting the selected layer mask (img2img). The accepted output is also masked in the editor, so it cannot replace pixels outside the selected region.
- Preview, discard, accept as an independent artwork layer, and client-side request cancellation.

No model is installed, downloaded, or run automatically. The user must separately start a compatible local server with API enabled (typically `--api`), a loaded checkpoint, and CORS permitting the exact Studio application origin. Default endpoint is `http://127.0.0.1:7860`. Do not bind the server publicly or disable browser protections. The application rejects non-loopback endpoints and redirects. API authentication and remote GPU providers are not supported in this candidate. The user's Intel Mac may not be suitable for diffusion inference; a separately provisioned compatible local GPU setup is necessary for practical speeds.

This adapter is **single UV-sheet generation, not 360-degree multi-view texturing**. The requested full-object, seam-consistent engine still requires an actual dedicated model/provider and verification. Local cancel stops waiting and discards the result, but does not guarantee that the diffusion server itself stops computing. Output generation is capped at 1024 pixels on the longest side and resized to the selected texture sheet. No normal or roughness maps are generated. All source material channels and original GLB data remain preserved.

API implementation reference: https://github.com/AUTOMATIC1111/stable-diffusion-webui/blob/master/modules/api/api.py

## Verification and release

The draft pull request targets the 1.6 surface branch, not main. The Linux CI now includes real two-material GLB export/reopen, document independence, multi-material persistence, backward compatibility, mask polarity and a **mocked** local API request/response contract. A successful mock does not establish a working inference server or output quality.

The Intel Mac candidate is packaged only after the Linux gate. Consult the latest PR checks for results. Use only a successful 1.7.0 source update archive and run the local installer using `bash scripts/install-mac-update.sh`. Do not replace the verified 1.6.0 source or delete local project history. Actual destination Mac UI launch, real diffusion server testing and Photoshop desktop verification remain release blockers.

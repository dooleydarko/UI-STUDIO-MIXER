# Project Recovery & Disaster Procedures

## Checkpoint Strategy

The application and repository maintain state through multiple decoupled mechanisms:

1. **Git Version Control:**
   - Every completed milestone and critical repair creates a descriptive Git commit.
   - Run `git status` and `git log --oneline -n 10` to inspect recent checkpoints.

2. **Database & Schema Backups:**
   - The application serializes all library components, mixer history, and 3D studio projects to JSON snapshots in `~/.gemini/antigravity/scratch/code-mixer-3d-studio/storage/` and optionally mirrors to `/Volumes/Extreme/CodeMixerStorage/` if the SanDisk drive is mounted.
   - Version schema is stamped on every record (`schemaVersion: 1`). Backward migrations are executed on startup if schema updates occur.

3. **Restoring from a Checkpoint:**
   ```bash
   # View available commits
   git log --oneline

   # Restore workspace to a previous known-good commit
   git checkout <commit-hash>

   # Reinstall clean dependencies if necessary
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Handling Missing External Storage:**
   - If `/Volumes/Extreme` is unmounted or disconnected, the storage manager switches transparently to local persistence without raising unhandled errors.
   - A visual badge indicates "Storage: Local (External SanDisk Disconnected)" and avoids silent data loss.

5. **Recovery After Crashed AI Generation:**
   - AI mix jobs save source components and partial outputs in atomic staging folders (`.staging/<job-id>/`).
   - If a crash or timeout occurs mid-generation, the mixer detects orphaned staging folders on next boot and cleanly offers to discard or resume them.

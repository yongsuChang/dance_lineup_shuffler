# Dance Lineup Shuffler Development Plan

## 1. Project Setup
- [x] **Tech Stack Decision**: Python with CustomTkinter (Cross-platform GUI), JSON for storage. **PyInstaller** will be used to generate a Windows `.exe` file.
- [x] Initialize project environment (virtualenv, requirements).
- [x] Create basic project structure.

## 2. Requirements Gathering (Completed)
- [x] Define "Tables" structure.
- [x] Collect specific settings/constraints for shuffling (User to provide).
- [x] Define data storage schema (JSON).

## 3. Core Logic Implementation (In Progress)
- [x] Create `DataManager` class to handle JSON file I/O.
- [x] Implement `Shuffler` engine with constraint logic (Basic implementation).

## 4. GUI Implementation (In Progress)
- [x] Main application window setup.
- [x] Settings/Configuration tab.
- [x] Data Management tab (Classes, Students, Pairs, Exclusions).
  - [x] Excel Copy-Paste Import for Students and Pairs.
- [x] Home screen with "Shuffle" button and results display.
- [ ] Interactive features (Re-shuffle, Lock specific slots, etc.).

## 5. Testing & Refinement
- [ ] Verify constraints are met with real data.
- [ ] User Interface polish.
- [ ] Packaging (PyInstaller).

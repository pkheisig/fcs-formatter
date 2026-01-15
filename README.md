# 🧬 FCS Smart Renamer

FCS Smart Renamer is a powerful and user-friendly GUI application designed to streamline the process of renaming channels and filenames for Flow Cytometry Standard (FCS) files. Built with Python and CustomTkinter, it offers a modern interface for managing your flow cytometry data efficiently.

## ✨ Features

- **📂 Drag & Drop Support:** Easily load files or folders by dragging them into the application.
- **🏷️ Smart Channel Renaming:**
  - View and edit channel names and labels.
  - **Auto-Mapping:** Automatically map markers to channels based on hardware configurations (e.g., BD Fortessa).
  - **Paste Support:** Paste lists of markers directly to map them.
  - **Batch Apply:** Apply channel renaming to all loaded files at once.
- **✏️ Advanced File Renaming:**
  - Batch rename files with prefixes and suffixes.
  - Find and replace text in filenames.
  - **Sequential Renaming:** Rename files with a base name and auto-incrementing numbers (e.g., `Sample_001.fcs`, `Sample_002.fcs`).
- **⚙️ Configuration Management:**
  - Pre-loaded configurations for **BD Fortessa 3L** and **4L**.
  - Create, load, and save custom JSON configurations for your specific instruments.
- **🛡️ Safety First:**
  - Automatic backup creation (`_backup` folder) before modifying files.
  - Option to keep original hardware names in labels.
- **🌑 Dark Mode:** A sleek dark-themed interface for comfortable usage.

## 🛠️ Installation

### Prerequisites

- Python 3.x installed on your system.

### Install Dependencies

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

## 🚀 Usage

1. **Run the Application:**
   ```bash
   python main.py
   ```

2. **Load Files:**
   - Click **"Browse Folder"** to select a directory containing `.fcs` files.
   - Or, simply **Drag & Drop** files or folders onto the application window.

3. **Rename Channels (Channels Tab):**
   - Select a file from the sidebar list.
   - Edit the **"Marker"** entries manually, or use the **"Paste Marker List/Table"** feature.
   - Choose a configuration from the dropdown (e.g., `BD Fortessa 3L`) to enable auto-mapping.
   - Click **"Save & Apply to All Files"** to update all loaded files.

4. **Rename Files (Filenames Tab):**
   - Use the **Prefix** and **Suffix** tools to add text to filenames.
   - Use **Find & Replace** to modify existing names.
   - Use **Sequential Rename** to standardize naming (e.g., `Experiment_01`).
   - Click **"Apply Filename Changes"** to save changes to disk.

## ⚙️ Configuration

The tool supports custom configurations for mapping hardware channels to markers.

- **Load Config:** Load a `.json` file containing your instrument's channel mappings.
- **Save Config:** Save your current mappings as a new configuration for future use.

**Example Configuration Format (`config.json`):**
```json
{
    "450/50-V-A": ["DAPI", "BV421"],
    "488/10-B-A": ["SSC"]
}
```

## 📦 Building Executable

To create a standalone executable for Windows:

1. Ensure `pyinstaller` is installed:
   ```bash
   pip install pyinstaller
   ```
2. Run the build script:
   ```bash
   build_exe.bat
   ```
   *Alternatively, run:*
   ```bash
   pyinstaller --noconfirm --onefile --windowed --add-data "fcs_handler.py;." --name "FCS Smart Renamer" "main.py"
   ```

The executable will be located in the `dist` folder.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT License](LICENSE)

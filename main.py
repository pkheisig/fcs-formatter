import customtkinter as ctk
from tkinterdnd2 import DND_FILES, TkinterDnD
import os
import json
from fcs_handler import FCSHandler
from tkinter import filedialog, messagebox

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class FCSRenamerApp(ctk.CTk, TkinterDnD.DnDWrapper):
    def __init__(self):
        super().__init__()
        self.TkdndVersion = TkinterDnD._require(self)
        
        self.title("FCS Smart Renamer")
        self.geometry("1000x700")
        self.minsize(1000, 700)
        
        # Data
        self.files = []
        self.current_fcs = None
        self.current_file_path = None
        self.entries = {}
        self.file_entries = {}
        self.file_vars = {} 
        self.file_buttons = {}
        self.var_keep_hw = None 
        self.var_backup = None
        self.custom_configs = {} 

        self.create_widgets()
        
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(1, weight=1)

    def create_widgets(self):
        # --- Top Bar ---
        self.top_frame = ctk.CTkFrame(self, height=60, corner_radius=0)
        self.top_frame.grid(row=0, column=0, columnspan=2, sticky="ew")
        
        self.btn_browse = ctk.CTkButton(self.top_frame, text="Browse Folder", command=self.browse_folder, width=150)
        self.btn_browse.pack(side="left", padx=20, pady=15)
        
        # Config Selector
        self.lbl_config = ctk.CTkLabel(self.top_frame, text="Config:")
        self.lbl_config.pack(side="left", padx=(20, 5))
        
        self.update_config_dropdown()
        
        # Backup Checkbox
        self.var_backup = ctk.BooleanVar(value=True)
        self.chk_backup = ctk.CTkCheckBox(self.top_frame, text="Create Backups", variable=self.var_backup)
        self.chk_backup.pack(side="left", padx=20)

        self.lbl_status = ctk.CTkLabel(self.top_frame, text="Drag & Drop files or browse", text_color="gray")
        self.lbl_status.pack(side="left", padx=20)

        self.drop_target_register(DND_FILES)
        self.dnd_bind('<<Drop>>', self.drop_files)

        # --- Sidebar ---
        self.sidebar = ctk.CTkFrame(self, width=250, corner_radius=0)
        self.sidebar.grid(row=1, column=0, sticky="ns")
        self.sidebar.grid_rowconfigure(1, weight=1)
        
        self.lbl_files = ctk.CTkLabel(self.sidebar, text="Files", font=("Roboto", 16, "bold"))
        self.lbl_files.grid(row=0, column=0, padx=20, pady=20, sticky="w")
        
        self.file_listbox = ctk.CTkScrollableFrame(self.sidebar, width=220)
        self.file_listbox.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")
        
        self.btn_remove = ctk.CTkButton(self.sidebar, text="Remove Selected", command=self.remove_current_file, fg_color="transparent", border_width=1, text_color=("gray10", "#DCE4EE"))
        self.btn_remove.grid(row=2, column=0, padx=20, pady=10)
        
        self.btn_clear = ctk.CTkButton(self.sidebar, text="Clear All", command=self.clear_all_files, fg_color="transparent", border_width=1, text_color=("gray10", "#DCE4EE"))
        self.btn_clear.grid(row=3, column=0, padx=20, pady=(0, 20))

        # --- Tabs ---
        self.tab_view = ctk.CTkTabview(self, corner_radius=10)
        self.tab_view.grid(row=1, column=1, padx=20, pady=20, sticky="nsew")
        
        self.tab_channels = self.tab_view.add("Channels")
        self.tab_files = self.tab_view.add("Filenames")
        
        self.setup_channels_tab()
        self.setup_files_tab()

    def update_config_dropdown(self):
        configs = list(FCSHandler.CONFIGURATIONS.keys()) + list(self.custom_configs.keys())
        if hasattr(self, 'combo_config'):
            self.combo_config.configure(values=configs)
        else:
            self.combo_config = ctk.CTkOptionMenu(self.top_frame, values=configs, width=150)
            self.combo_config.set(configs[0] if configs else "")
            self.combo_config.pack(side="left", padx=5)

    def setup_channels_tab(self):
        self.tab_channels.grid_columnconfigure(0, weight=1)
        self.tab_channels.grid_rowconfigure(1, weight=1)

        self.editor_header = ctk.CTkFrame(self.tab_channels, height=40, fg_color="transparent")
        self.editor_header.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        self.editor_header.grid_columnconfigure(1, weight=1)
        
        ctk.CTkLabel(self.editor_header, text="Channel", width=200, anchor="w", font=("Roboto", 14, "bold")).grid(row=0, column=0, padx=5, sticky="w")
        ctk.CTkLabel(self.editor_header, text="Marker", width=200, anchor="w", font=("Roboto", 14, "bold")).grid(row=0, column=1, padx=5, sticky="w")

        self.channel_frame = ctk.CTkScrollableFrame(self.tab_channels)
        self.channel_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        self.channel_frame.grid_columnconfigure(1, weight=1)
        
        self.tools_frame = ctk.CTkFrame(self.tab_channels, height=150)
        self.tools_frame.grid(row=2, column=0, sticky="ew", padx=10, pady=10)
        
        # Row 0
        self.btn_paste = ctk.CTkButton(self.tools_frame, text="Paste Marker List/Table", command=self.open_paste_window)
        self.btn_paste.grid(row=0, column=0, padx=10, pady=5, sticky="w")
        
        self.var_keep_hw = ctk.BooleanVar(value=True)
        self.chk_keep_hw = ctk.CTkCheckBox(self.tools_frame, text="Keep Hardware Name in Label", variable=self.var_keep_hw)
        self.chk_keep_hw.grid(row=0, column=1, padx=20, pady=5, sticky="w")

        self.btn_save_all = ctk.CTkButton(self.tools_frame, text="Save & Apply to All Files", command=self.apply_channels_to_all, fg_color="#2CC985", hover_color="#1FA66B")
        self.btn_save_all.grid(row=0, column=2, padx=20, pady=5, sticky="e")
        
        # Row 1 (Config Tools)
        self.btn_load_config = ctk.CTkButton(self.tools_frame, text="Load Config...", width=100, command=self.load_custom_config_dialog)
        self.btn_load_config.grid(row=1, column=0, padx=10, pady=5, sticky="w")
        
        self.btn_save_config = ctk.CTkButton(self.tools_frame, text="Save Current Config...", width=100, command=self.save_custom_config_dialog)
        self.btn_save_config.grid(row=1, column=1, padx=20, pady=5, sticky="w")
        
        self.tools_frame.grid_columnconfigure(2, weight=1)

    def load_custom_config_dialog(self):
        path = filedialog.askopenfilename(filetypes=[("JSON files", "*.json")])
        if path:
            data = FCSHandler.load_custom_config(path)
            if data:
                name = os.path.basename(path).replace('.json', '')
                self.custom_configs[name] = data
                self.update_config_dropdown()
                self.combo_config.set(name)
                messagebox.showinfo("Config Loaded", f"Loaded configuration '{name}'.")
            else:
                messagebox.showerror("Error", "Failed to load configuration.")

    def save_custom_config_dialog(self):
        if not self.current_fcs: return
        config_data = {}
        for ch, entry in self.entries.items():
            val = entry.get()
            if self.var_keep_hw.get() and " | " in val:
                prefix = f"{ch} | "
                if val.startswith(prefix):
                    val = val[len(prefix):]
            
            if val:
                config_data[ch] = [val] 
        
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON files", "*.json")])
        if path:
            if FCSHandler.save_custom_config(path, config_data):
                messagebox.showinfo("Success", "Configuration saved.")

    def open_paste_window(self):
        if not self.current_fcs:
            messagebox.showwarning("Warning", "No FCS file loaded.")
            return
            
        dialog = ctk.CTkToplevel(self)
        dialog.title("Paste Markers")
        dialog.geometry("400x400")
        dialog.transient(self) 
        
        ctk.CTkLabel(dialog, text="Paste list (comma/newline separated):").pack(pady=5)
        
        textbox = ctk.CTkTextbox(dialog, width=350, height=250)
        textbox.pack(pady=5, padx=10)
        
        def process():
            content = textbox.get("1.0", "end")
            self.run_auto_map(content)
            dialog.destroy()
            
        ctk.CTkButton(dialog, text="Process & Map", command=process).pack(pady=10)

    def setup_files_tab(self):
        self.tab_files.grid_columnconfigure(0, weight=1)
        self.tab_files.grid_rowconfigure(3, weight=1) 

        # Row 0: Batch Tools (Prefix/Suffix)
        self.batch_frame = ctk.CTkFrame(self.tab_files, height=50)
        self.batch_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=5)
        
        self.btn_sel_all = ctk.CTkButton(self.batch_frame, text="Select All", width=80, command=lambda: self.set_selection(True))
        self.btn_sel_all.pack(side="left", padx=5, pady=5)
        self.btn_desel_all = ctk.CTkButton(self.batch_frame, text="Deselect All", width=80, command=lambda: self.set_selection(False))
        self.btn_desel_all.pack(side="left", padx=5, pady=5)
        
        ctk.CTkLabel(self.batch_frame, text="Prefix:").pack(side="left", padx=5)
        self.entry_prefix = ctk.CTkEntry(self.batch_frame, width=100)
        self.entry_prefix.pack(side="left", padx=5)
        self.btn_add_prefix = ctk.CTkButton(self.batch_frame, text="Add", width=60, command=self.add_prefix)
        self.btn_add_prefix.pack(side="left", padx=2)

        ctk.CTkLabel(self.batch_frame, text="Suffix:").pack(side="left", padx=5)
        self.entry_suffix = ctk.CTkEntry(self.batch_frame, width=100)
        self.entry_suffix.pack(side="left", padx=5)
        self.btn_add_suffix = ctk.CTkButton(self.batch_frame, text="Add", width=60, command=self.add_suffix)
        self.btn_add_suffix.pack(side="left", padx=2)

        # Row 1: Find & Replace / Sequence
        self.fr_frame = ctk.CTkFrame(self.tab_files, height=50)
        self.fr_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=5)
        
        ctk.CTkLabel(self.fr_frame, text="Find:").pack(side="left", padx=5)
        self.entry_find = ctk.CTkEntry(self.fr_frame, width=100)
        self.entry_find.pack(side="left", padx=5)
        
        ctk.CTkLabel(self.fr_frame, text="Replace:").pack(side="left", padx=5)
        self.entry_replace = ctk.CTkEntry(self.fr_frame, width=100)
        self.entry_replace.pack(side="left", padx=5)
        
        self.btn_fr = ctk.CTkButton(self.fr_frame, text="Replace Selected", width=120, command=self.run_find_replace)
        self.btn_fr.pack(side="left", padx=10)
        
        self.btn_seq = ctk.CTkButton(self.fr_frame, text="Sequential Rename", width=120, command=self.open_seq_rename)
        self.btn_seq.pack(side="left", padx=10)

        # Row 2: Header
        self.files_header = ctk.CTkFrame(self.tab_files, height=40, fg_color="transparent")
        self.files_header.grid(row=2, column=0, sticky="ew", padx=10, pady=5)
        self.files_header.grid_columnconfigure(2, weight=1)

        ctk.CTkLabel(self.files_header, text="", width=30, anchor="w").grid(row=0, column=0, padx=5, sticky="w")
        ctk.CTkLabel(self.files_header, text="Current Filename", width=250, anchor="w", font=("Roboto", 14, "bold")).grid(row=0, column=1, padx=5, sticky="w")
        ctk.CTkLabel(self.files_header, text="New Filename", width=250, anchor="w", font=("Roboto", 14, "bold")).grid(row=0, column=2, padx=5, sticky="w")

        # Row 3: List
        self.file_renamer_frame = ctk.CTkScrollableFrame(self.tab_files)
        self.file_renamer_frame.grid(row=3, column=0, sticky="nsew", padx=10, pady=5)
        self.file_renamer_frame.grid_columnconfigure(2, weight=1)

        # Row 4: Apply
        self.btn_rename_files = ctk.CTkButton(self.tab_files, text="Apply Filename Changes", command=self.run_rename_files, fg_color="#2CC985", hover_color="#1FA66B")
        self.btn_rename_files.grid(row=4, column=0, padx=20, pady=10, sticky="e")

    def run_find_replace(self):
        find_str = self.entry_find.get()
        replace_str = self.entry_replace.get()
        if not find_str: return
        
        for path, var in self.file_vars.items():
            if var.get():
                entry = self.file_entries[path]
                current = entry.get()
                if not current:
                    current = os.path.splitext(os.path.basename(path))[0]
                
                new_val = current.replace(find_str, replace_str)
                entry.delete(0, "end")
                entry.insert(0, new_val)

    def open_seq_rename(self):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Sequential Rename")
        dialog.geometry("300x250")
        dialog.transient(self)
        
        ctk.CTkLabel(dialog, text="Base Name:").pack(pady=5)
        entry_base = ctk.CTkEntry(dialog)
        entry_base.pack(pady=5)
        entry_base.insert(0, "Sample_")
        
        ctk.CTkLabel(dialog, text="Start Number:").pack(pady=5)
        entry_start = ctk.CTkEntry(dialog)
        entry_start.pack(pady=5)
        entry_start.insert(0, "1")
        
        ctk.CTkLabel(dialog, text="Digits (e.g., 3 -> 001):").pack(pady=5)
        entry_digits = ctk.CTkEntry(dialog)
        entry_digits.pack(pady=5)
        entry_digits.insert(0, "3")
        
        def apply_seq():
            base = entry_base.get()
            try:
                start = int(entry_start.get())
                digits = int(entry_digits.get())
            except ValueError:
                messagebox.showerror("Error", "Start Number and Digits must be integers.")
                return
            
            count = 0
            for path in self.files:
                if self.file_vars[path].get():
                    new_name = f"{base}{str(start+count).zfill(digits)}"
                    
                    entry = self.file_entries[path]
                    entry.delete(0, "end")
                    entry.insert(0, new_name)
                    count += 1
            dialog.destroy()
            
        ctk.CTkButton(dialog, text="Apply", command=apply_seq).pack(pady=20)

    def browse_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            fcs_files = [os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith('.fcs')]
            self.load_file_list(fcs_files)

    def drop_files(self, event):
        raw_files = self.tk.splitlist(event.data)
        valid_files = []
        for f in raw_files:
            if os.path.isdir(f):
                for root, _, filenames in os.walk(f):
                    for name in filenames:
                        if name.lower().endswith('.fcs'):
                            valid_files.append(os.path.join(root, name))
            elif f.lower().endswith('.fcs'):
                valid_files.append(f)
        self.load_file_list(valid_files)

    def load_file_list(self, file_paths):
        current_set = set(self.files)
        for f in file_paths:
            if f not in current_set:
                self.files.append(f)
        self.refresh_ui_file_lists()
        if self.files and not self.current_file_path:
            self.load_fcs_editor(self.files[0])

    def refresh_ui_file_lists(self):
        self.lbl_status.configure(text=f"{len(self.files)} files loaded.")
        for widget in self.file_listbox.winfo_children(): widget.destroy()
        self.file_buttons = {}
        for f in self.files:
            is_selected = (f == self.current_file_path)
            fg = "gray40" if is_selected else "transparent"
            name_no_ext = os.path.splitext(os.path.basename(f))[0]
            btn = ctk.CTkButton(self.file_listbox, text=name_no_ext, anchor="w", fg_color=fg, border_width=1, border_color="gray", command=lambda path=f: self.load_fcs_editor(path))
            btn.pack(fill="x", pady=2)
            self.file_buttons[f] = btn
        
        for widget in self.file_renamer_frame.winfo_children(): widget.destroy()
        self.file_entries = {}
        self.file_vars = {}
        for i, f in enumerate(self.files):
            name_no_ext = os.path.splitext(os.path.basename(f))[0]
            var = ctk.BooleanVar(value=False)
            self.file_vars[f] = var
            chk = ctk.CTkCheckBox(self.file_renamer_frame, text="", variable=var, width=20)
            chk.grid(row=i, column=0, padx=5, pady=2, sticky="w")
            lbl = ctk.CTkLabel(self.file_renamer_frame, text=name_no_ext, width=250, anchor="w")
            lbl.grid(row=i, column=1, padx=5, pady=2, sticky="w")
            entry = ctk.CTkEntry(self.file_renamer_frame)
            entry.insert(0, "")
            entry.grid(row=i, column=2, padx=5, pady=2, sticky="ew")
            self.file_entries[f] = entry

    def set_selection(self, state):
        for var in self.file_vars.values(): var.set(state)

    def add_prefix(self):
        prefix = self.entry_prefix.get()
        if not prefix: return
        for path, var in self.file_vars.items():
            if var.get():
                entry = self.file_entries[path]
                current = entry.get()
                if not current: current = os.path.splitext(os.path.basename(path))[0]
                entry.delete(0, "end")
                entry.insert(0, prefix + current)

    def add_suffix(self):
        suffix = self.entry_suffix.get()
        if not suffix: return
        for path, var in self.file_vars.items():
            if var.get():
                entry = self.file_entries[path]
                current = entry.get()
                if not current: current = os.path.splitext(os.path.basename(path))[0]
                entry.delete(0, "end")
                entry.insert(0, current + suffix)

    def load_fcs_editor(self, file_path):
        if file_path not in self.files: return
        self.current_file_path = file_path
        for path, btn in self.file_buttons.items():
            if path == file_path: btn.configure(fg_color="gray40")
            else: btn.configure(fg_color="transparent")
        try:
            self.current_fcs = FCSHandler(file_path)
            self.refresh_channel_list()
        except Exception as e:
            messagebox.showerror("Error", f"Could not load FCS file:\n{e}")

    def refresh_channel_list(self):
        for widget in self.channel_frame.winfo_children(): widget.destroy()
        self.entries = {}
        info = self.current_fcs.get_channel_info()
        for i, item in enumerate(info):
            lbl_hw = ctk.CTkLabel(self.channel_frame, text=item['channel'], width=200, anchor="w")
            lbl_hw.grid(row=i, column=0, padx=5, pady=5, sticky="w")
            entry = ctk.CTkEntry(self.channel_frame)
            entry.insert(0, item['current_label'])
            entry.grid(row=i, column=1, padx=5, pady=5, sticky="ew")
            self.entries[item['channel']] = entry

    def run_auto_map(self, input_text):
        if not self.current_fcs or not input_text: return
        cleaned_text = input_text.replace('\n', ',')
        config_name = self.combo_config.get()
        
        custom = self.custom_configs.get(config_name)
        
        channels = [k for k in self.entries.keys()]
        mapping = FCSHandler.auto_map(channels, cleaned_text, config_name=config_name, custom_db=custom)
        
        for ch_name, new_val in mapping.items():
            if ch_name in self.entries:
                self.entries[ch_name].delete(0, "end")
                self.entries[ch_name].insert(0, new_val)
        
        count = len(mapping)
        self.lbl_status.configure(text=f"Auto-mapped {count} channels using {config_name}.")

    def apply_channels_to_all(self):
        if not self.files: return
        current_mapping_ui = {}
        for ch_name, entry in self.entries.items():
            val = entry.get()
            current_mapping_ui[ch_name] = val
        keep_hw = self.var_keep_hw.get()
        create_backup = self.var_backup.get()
        count = 0
        errors = []
        for path in self.files:
            try:
                if path == self.current_file_path and self.current_fcs:
                    handler = self.current_fcs
                else:
                    handler = FCSHandler(path)
                
                final_mapping = {}
                for ch, marker in current_mapping_ui.items():
                    if marker:
                        if keep_hw:
                            prefix = f"{ch} | "
                            if marker.startswith(prefix):
                                val = marker
                            else:
                                val = f"{prefix}{marker}"
                        else:
                            val = marker
                        final_mapping[ch] = val
                
                handler.update_labels(final_mapping)
                handler.save_file(create_backup=create_backup)
                count += 1
            except Exception as e:
                errors.append(f"{os.path.basename(path)}: {e}")
        
        if errors:
            msg = "\n".join(errors[:5])
            if len(errors) > 5: msg += "\n..."
            messagebox.showwarning("Batch Errors", f"Applied to {count} files, but some failed:\n{msg}")
        else:
            messagebox.showinfo("Batch Update", f"Successfully applied channels to {count} files.")

    def save_current_file(self):
        pass

    def run_rename_files(self):
        renamed_count = 0
        errors = []
        to_rename = {}
        create_backup = self.var_backup.get()
        
        for old_path, entry in self.file_entries.items():
            new_name_no_ext = entry.get()
            old_name_no_ext = os.path.splitext(os.path.basename(old_path))[0]
            if new_name_no_ext and new_name_no_ext != old_name_no_ext:
                new_full_name = new_name_no_ext + ".fcs"
                to_rename[old_path] = new_full_name
        
        if not to_rename: return
        new_files_list = []
        for path in self.files:
            if path in to_rename:
                new_name = to_rename[path]
                try:
                    if path == self.current_file_path and self.current_fcs:
                        handler = self.current_fcs
                    else:
                        handler = FCSHandler(path)
                    new_path = handler.rename_file(new_name, create_backup=create_backup)
                    new_files_list.append(new_path)
                    renamed_count += 1
                    if path == self.current_file_path:
                        self.current_file_path = new_path
                except Exception as e:
                    errors.append(f"{os.path.basename(path)}: {e}")
                    new_files_list.append(path)
            else:
                new_files_list.append(path)
        self.files = new_files_list
        self.refresh_ui_file_lists()
        if errors:
            msg = "\n".join(errors[:10])
            if len(errors) > 10: msg += "\n..."
            messagebox.showwarning("Rename Errors", f"Some files failed to rename:\n{msg}")
        else:
            messagebox.showinfo("Success", f"Renamed {renamed_count} files.")

    def remove_current_file(self):
        if self.current_file_path and self.current_file_path in self.files:
            self.files.remove(self.current_file_path)
            self.current_file_path = None
            self.current_fcs = None
            for widget in self.channel_frame.winfo_children(): widget.destroy()
            if self.files: self.load_fcs_editor(self.files[0])
            self.refresh_ui_file_lists()

    def clear_all_files(self):
        self.files = []
        self.current_file_path = None
        self.current_fcs = None
        for widget in self.channel_frame.winfo_children(): widget.destroy()
        self.refresh_ui_file_lists()

if __name__ == "__main__":
    app = FCSRenamerApp()
    app.mainloop()

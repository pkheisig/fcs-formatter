import flowio
import os
import re
import json
import shutil
import datetime

class FCSHandler:
    # Embedded configurations
    CONFIGURATIONS = {
        "BD Fortessa 3L": {
            "450/50-V-A": ["BV421", "Alexa 405", "eFluor 450", "Hoechst", "Pacific Blue", "DAPI", "Sytox"],
            "525/50-V-A": ["AmCyan", "V500", "BV510", "Qdot 525", "Krome Orange", "Pacific Orange"],
            "610/20-V-A": ["BV605", "eFluor 605NC", "Qdot 605"],
            "670/30-V-A": ["BV650", "eFluor 650NC", "Qdot 655"],
            "710/50-V-A": ["eFluor 700NC", "Qdot 705", "BV711"],
            "780/60-V-A": ["BV786", "Qdot 800"],
            "488/10-B-A": ["SSC"],
            "525/50-B-A": ["GFP", "FITC", "Alexa 488", "CFSE"],
            "575/26-B-A": ["PKH26", "PE"],
            "610/20-B-A": ["Texas Red", "PE-CF594", "PE-Texas Red", "PI"],
            "695/40-B-A": ["7AAD", "PE-Cy5", "PerCP", "PE-Cy5.5", "PerCP-Cy5.5", "PerCP eFluor 710"],
            "780/60-B-A": ["PC7", "PE-Vio 7", "PE-CY7"],
            "670/30-R-A": ["APC", "TOPRO-3", "TOTO-3", "Alexa 647", "eFluor 660"],
            "730/45-R-A": ["eFluor 710", "APC-Alexa 700", "Alexa 700"],
            "780/60-R-A": ["APC-Vio 770", "Alexa Fluor 750", "APC-eFluor 780", "APC-Cy7", "APC-H7"]
        },
        "BD Fortessa 4L": {
            "450/50-V-A": ["BV421", "Alexa 405", "eFluor 450", "Pacific Blue", "DAPI", "Sytox"],
            "525/50-V-A": ["BV510"],
            "610/20-V-A": ["BV605"],
            "670/30-V-A": ["BV650"],
            "710/50-V-A": ["BV711"],
            "780/60-V-A": ["BV786"],
            "488/10-B-A": ["SSC"],
            "529/24-B-A": ["FITC", "Alexa 488", "GFP"],
            "695/40-B-A": ["PerCP", "PerCP-Cy5.5", "PerCP eFluor 710"],
            "582/15-YG-A": ["PE"],
            "610/20-YG-A": ["mCherry", "PE-CF 594", "PE-Texas Red", "PI", "7AAD"],
            "670/14-YG-A": ["PE-Cy5"],
            "710/50-YG-A": ["PE-Cy5.5"],
            "780/60-YG-A": ["PE-CY7"],
            "670/30-R-A": ["APC", "Alexa Fluor 647", "eFluor 660"],
            "730/45-R-A": ["Alexa Fluor 700"],
            "780/60-R-A": ["Alexa Fluor 750", "APC-eFluor 780", "APC-H7", "APC-Cy7"]
        }
    }

    def __init__(self, file_path):
        self.file_path = file_path
        self.flow_data = flowio.FlowData(file_path)
        self.channels = self._extract_channels()

    def _extract_channels(self):
        channels = {}
        for i in range(1, self.flow_data.channel_count + 1):
            candidates_n = [f'$P{i}N', f'P{i}N', f'$p{i}n', f'p{i}n']
            candidates_s = [f'$P{i}S', f'P{i}S', f'$p{i}s', f'p{i}s']
            
            pnn_key = candidates_n[0]
            pnn = ""
            for key in candidates_n:
                if key in self.flow_data.text:
                    pnn_key = key
                    pnn = self.flow_data.text[key]
                    break
            
            pns_key = candidates_s[0]
            pns = ""
            found_s = False
            for key in candidates_s:
                if key in self.flow_data.text:
                    pns_key = key
                    pns = self.flow_data.text[key]
                    found_s = True
                    break
            
            if not found_s:
                if pnn_key == f'p{i}n':
                    pns_key = f'p{i}s'
                elif pnn_key == f'$p{i}n':
                    pns_key = f'$p{i}s'
                elif pnn_key == f'P{i}N':
                    pns_key = f'P{i}S'
                else:
                    pns_key = f'$P{i}S'

            channels[i] = {
                'name': pnn,
                'label': pns,
                'original_pnn_key': pnn_key,
                'original_pns_key': pns_key
            }
        return channels

    def get_channel_info(self):
        info = []
        for idx, data in self.channels.items():
            info.append({
                'id': idx,
                'channel': data['name'],
                'current_label': data['label']
            })
        return info

    def update_labels(self, mapping):
        name_to_index = {data['name']: idx for idx, data in self.channels.items()}
        
        for channel_name, new_label in mapping.items():
            if channel_name in name_to_index:
                idx = name_to_index[channel_name]
                pns_key = self.channels[idx]['original_pns_key']
                
                self.flow_data.text[pns_key] = new_label
                self.channels[idx]['label'] = new_label
                
                # Also update flow_data.channels if it exists
                # This is crucial for FlowIO to write the correct PnS value
                if hasattr(self.flow_data, 'channels') and isinstance(self.flow_data.channels, dict):
                    str_idx = str(idx)
                    if str_idx in self.flow_data.channels:
                        self.flow_data.channels[str_idx]['PnS'] = new_label

    def create_backup(self):
        directory = os.path.dirname(self.file_path)
        filename = os.path.basename(self.file_path)
        backup_dir = os.path.join(directory, "_backup")
        
        if not os.path.exists(backup_dir):
            try:
                os.makedirs(backup_dir)
            except OSError as e:
                print(f"Error creating backup dir: {e}")
                return None
            
        backup_path = os.path.join(backup_dir, filename)
        
        # If backup exists, we assume it's the original and don't overwrite it
        if os.path.exists(backup_path):
            return backup_path
            
        try:
            shutil.copy2(self.file_path, backup_path)
            return backup_path
        except Exception as e:
            print(f"Error creating backup: {e}")
            return None

    def save_file(self, output_path=None, create_backup=False):
        if create_backup:
            self.create_backup()
            
        if output_path is None:
            output_path = self.file_path
        self.flow_data.write_fcs(output_path)
    
    def rename_file(self, new_filename, create_backup=False):
        directory = os.path.dirname(self.file_path)
        new_path = os.path.join(directory, new_filename)
        
        if create_backup:
            self.create_backup()

        if '$FIL' in self.flow_data.text:
            self.flow_data.text['$FIL'] = new_filename
        elif 'FIL' in self.flow_data.text:
            self.flow_data.text['FIL'] = new_filename
        else:
            self.flow_data.text['$FIL'] = new_filename
            
        self.save_file(new_path) # We don't backup again here
        
        if os.path.abspath(self.file_path) != os.path.abspath(new_path):
            try:
                os.remove(self.file_path)
            except OSError as e:
                print(f"Warning: Could not remove old file {self.file_path}: {e}")
            
            self.file_path = new_path
            
        return new_path

    @staticmethod
    def auto_map(channels, input_markers, config_name="BD Fortessa 3L", custom_db=None):
        mapping = {}
        
        if custom_db:
            db = custom_db
        else:
            db = FCSHandler.CONFIGURATIONS.get(config_name, {})
        
        if isinstance(input_markers, str):
            if '|' in input_markers:
                marker_list = [m.strip() for m in input_markers.split('|')]
            elif ',' in input_markers:
                marker_list = [m.strip() for m in input_markers.split(',')]
            else:
                marker_list = [input_markers.strip()]
        else:
            marker_list = input_markers

        def normalize_channel(s):
            return s.replace(' ', '').replace('–', '-').upper()
            
        def normalize_color(s):
            s = s.lower()
            s = s.replace('fluor', '')
            s = re.sub(r'[^a-z0-9]', '', s)
            return s

        for ch in channels:
            ch_norm = normalize_channel(ch)
            best_match = None
            
            for db_key, possible_colors in db.items():
                if normalize_channel(db_key) in ch_norm:
                    for user_marker in marker_list:
                        u_norm = normalize_color(user_marker)
                        for c in possible_colors:
                            c_norm = normalize_color(c)
                            if u_norm == c_norm:
                                best_match = user_marker
                                break
                        if best_match: break
                    if best_match: break
            
            if best_match:
                mapping[ch] = best_match
                
        return mapping

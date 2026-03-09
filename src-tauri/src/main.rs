use anyhow::{Context, Result, anyhow};
use flow_fcs::{
    Fcs, edit_metadata_and_save,
    keyword::{FloatableKeyword, IntegerableKeyword, Keyword, StringableKeyword},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};
use tauri::Manager;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DetectorConfig {
    filter: String,
    fluorophores: Vec<String>,
    common_fluorophore: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CytometerConfig {
    name: String,
    detectors: Vec<DetectorConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigBootstrap {
    default_config: String,
    configs: Vec<CytometerConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChannelRecord {
    index: usize,
    detector: String,
    original_primary_name: String,
    primary_name: String,
    secondary_name: String,
    fluorescence: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MetadataEntry {
    key: String,
    value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FcsFileRecord {
    path: String,
    directory: String,
    file_name: String,
    original_base_name: String,
    output_base_name: String,
    size_bytes: u64,
    event_count: usize,
    parameter_count: usize,
    channels: Vec<ChannelRecord>,
    parameters: Vec<MetadataEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessRequest {
    files: Vec<FilePlan>,
    channel_template: Vec<ChannelEdit>,
    keep_originals: bool,
    output_directory: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilePlan {
    path: String,
    output_base_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChannelEdit {
    original_primary_name: String,
    primary_name: String,
    secondary_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessResult {
    created_files: Vec<String>,
    warnings: Vec<String>,
}

fn cytometer_configs() -> Vec<CytometerConfig> {
    vec![
        CytometerConfig {
            name: "BD Fortessa 3L".to_string(),
            detectors: vec![
                detector("450/50-V-A", &["BV421", "Alexa 405", "eFluor 450", "Hoechst", "Pacific Blue", "DAPI", "Sytox"]),
                detector("525/50-V-A", &["BV510", "AmCyan", "V500", "Qdot 525", "Krome Orange", "Pacific Orange"]),
                detector("610/20-V-A", &["BV605", "eFluor 605NC", "Qdot 605"]),
                detector("670/30-V-A", &["BV650", "eFluor 650NC", "Qdot 655"]),
                detector("710/50-V-A", &["BV711", "eFluor 700NC", "Qdot 705"]),
                detector("780/60-V-A", &["BV786", "Qdot 800"]),
                detector("488/10-B-A", &["SSC"]),
                detector("525/50-B-A", &["FITC", "GFP", "Alexa 488", "CFSE"]),
                detector("575/26-B-A", &["PE", "PKH26"]),
                detector("610/20-B-A", &["PE-CF594", "Texas Red", "PE-Texas Red", "PI"]),
                detector("695/40-B-A", &["PerCP", "PE-Cy5", "7AAD", "PE-Cy5.5", "PerCP-Cy5.5", "PerCP eFluor 710"]),
                detector("780/60-B-A", &["PE-CY7", "PC7", "PE-Vio 7"]),
                detector("670/30-R-A", &["APC", "Alexa 647", "TOPRO-3", "TOTO-3", "eFluor 660"]),
                detector("730/45-R-A", &["Alexa 700", "eFluor 710", "APC-Alexa 700"]),
                detector("780/60-R-A", &["APC-Cy7", "Alexa Fluor 750", "APC-Vio 770", "APC-eFluor 780", "APC-H7"]),
            ],
        },
        CytometerConfig {
            name: "BD Fortessa 4L".to_string(),
            detectors: vec![
                detector("450/50-V-A", &["BV421", "Alexa 405", "eFluor 450", "Pacific Blue", "DAPI", "Sytox"]),
                detector("525/50-V-A", &["BV510"]),
                detector("610/20-V-A", &["BV605"]),
                detector("670/30-V-A", &["BV650"]),
                detector("710/50-V-A", &["BV711"]),
                detector("780/60-V-A", &["BV786"]),
                detector("488/10-B-A", &["SSC"]),
                detector("529/24-B-A", &["FITC", "Alexa 488", "GFP"]),
                detector("695/40-B-A", &["PerCP", "PerCP-Cy5.5", "PerCP eFluor 710"]),
                detector("582/15-YG-A", &["PE"]),
                detector("610/20-YG-A", &["PE-CF 594", "mCherry", "PE-Texas Red", "PI", "7AAD"]),
                detector("670/14-YG-A", &["PE-Cy5"]),
                detector("710/50-YG-A", &["PE-Cy5.5"]),
                detector("780/60-YG-A", &["PE-CY7"]),
                detector("670/30-R-A", &["APC", "Alexa Fluor 647", "eFluor 660"]),
                detector("730/45-R-A", &["Alexa Fluor 700"]),
                detector("780/60-R-A", &["APC-Cy7", "Alexa Fluor 750", "APC-eFluor 780", "APC-H7"]),
            ],
        },
    ]
}

fn detector(filter: &str, fluorophores: &[&str]) -> DetectorConfig {
    DetectorConfig {
        filter: filter.to_string(),
        fluorophores: fluorophores.iter().map(|value| (*value).to_string()).collect(),
        common_fluorophore: fluorophores.first().map(|value| (*value).to_string()),
    }
}

fn keyword_value(keyword: &Keyword) -> String {
    match keyword {
        Keyword::Int(value) => value.get_usize().to_string(),
        Keyword::Float(value) => value.get_f32().to_string(),
        Keyword::String(value) => value.get_str().into_owned(),
        Keyword::Byte(value) => value.get_str().into_owned(),
        Keyword::Mixed(value) => value.get_str().into_owned(),
    }
}

fn expand_inputs(paths: &[String]) -> Result<Vec<PathBuf>> {
    let mut collected = BTreeSet::new();

    for raw_path in paths {
        let path = PathBuf::from(raw_path);
        if path.is_dir() {
            for entry in WalkDir::new(&path)
                .follow_links(true)
                .into_iter()
                .filter_map(|entry| entry.ok())
            {
                let entry_path = entry.path();
                if entry_path.is_file() && is_fcs_file(entry_path) {
                    collected.insert(entry_path.canonicalize().unwrap_or_else(|_| entry_path.to_path_buf()));
                }
            }
            continue;
        }

        if path.is_file() && is_fcs_file(&path) {
            collected.insert(path.canonicalize().unwrap_or(path));
        }
    }

    Ok(collected.into_iter().collect())
}

fn is_fcs_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("fcs"))
        .unwrap_or(false)
}

fn inspect_file(path: &Path) -> Result<FcsFileRecord> {
    let file_path = path
        .to_str()
        .ok_or_else(|| anyhow!("File path is not valid UTF-8"))?;
    let fcs = Fcs::open(file_path).with_context(|| format!("Failed to open {}", path.display()))?;

    let parameter_count = fcs.metadata.get_number_of_parameters().copied().unwrap_or(0);
    let event_count = fcs.metadata.get_number_of_events().copied().unwrap_or(0);
    let mut parameters = fcs
        .metadata
        .keywords
        .iter()
        .map(|(key, value)| MetadataEntry {
            key: key.clone(),
            value: keyword_value(value),
        })
        .collect::<Vec<_>>();
    parameters.sort_by(|left, right| left.key.cmp(&right.key));

    let mut channels = Vec::new();
    for index in 1..=parameter_count {
        let primary = fcs
            .metadata
            .get_parameter_channel_name(index)
            .map(|value| value.to_string())
            .unwrap_or_default();
        let secondary = fcs
            .metadata
            .get_parameter_label(index)
            .map(|value| value.to_string())
            .unwrap_or_default();

        channels.push(ChannelRecord {
            index,
            detector: primary.clone(),
            original_primary_name: primary.clone(),
            primary_name: primary.clone(),
            secondary_name: secondary,
            fluorescence: is_fluorescence_channel(&primary),
        });
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| anyhow!("File name is not valid UTF-8"))?
        .to_string();
    let original_base_name = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| anyhow!("File stem is not valid UTF-8"))?
        .to_string();
    let directory = path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_string_lossy()
        .to_string();
    let size_bytes = fs::metadata(path).map(|metadata| metadata.len()).unwrap_or(0);

    Ok(FcsFileRecord {
        path: path.to_string_lossy().to_string(),
        directory,
        file_name,
        original_base_name: original_base_name.clone(),
        output_base_name: original_base_name,
        size_bytes,
        event_count,
        parameter_count,
        channels,
        parameters,
    })
}

fn is_fluorescence_channel(channel_name: &str) -> bool {
    let upper = channel_name.to_uppercase();
    !upper.contains("FSC") && !upper.contains("SSC") && !upper.contains("TIME")
}

fn build_output_path(
    source_path: &Path,
    output_base_name: &str,
    keep_originals: bool,
    output_directory: Option<&str>,
) -> Result<PathBuf> {
    let parent = source_path
        .parent()
        .ok_or_else(|| anyhow!("Source path has no parent directory"))?;

    let root = if let Some(directory) = output_directory {
        PathBuf::from(directory)
    } else if keep_originals {
        parent.join("_formatted")
    } else {
        parent.to_path_buf()
    };

    fs::create_dir_all(&root)
        .with_context(|| format!("Failed to create output directory {}", root.display()))?;

    let candidate = root.join(format!("{output_base_name}.fcs"));
    if !candidate.exists() {
        return Ok(candidate);
    }

    for suffix in 2..10_000 {
        let attempt = root.join(format!("{output_base_name}_{suffix:03}.fcs"));
        if !attempt.exists() {
            return Ok(attempt);
        }
    }

    Err(anyhow!(
        "Unable to find a free output filename for {}",
        candidate.display()
    ))
}

fn apply_channel_template(fcs: Fcs, output_path: &Path, edits: &[ChannelEdit]) -> Result<()> {
    let mut edit_map = BTreeMap::new();
    for edit in edits {
        edit_map.insert(edit.original_primary_name.clone(), edit);
    }

    let output_name = output_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| anyhow!("Output filename is not valid UTF-8"))?
        .to_string();

    edit_metadata_and_save(fcs, output_path, move |metadata| {
        let parameter_count = metadata.get_number_of_parameters().copied().unwrap_or(0);
        for index in 1..=parameter_count {
            let current_primary = metadata
                .get_parameter_channel_name(index)
                .map(|value| value.to_string())
                .unwrap_or_default();

            if let Some(edit) = edit_map.get(&current_primary) {
                if !edit.primary_name.trim().is_empty() {
                    metadata.insert_string_keyword(format!("$P{index}N"), edit.primary_name.clone());
                }
                metadata.insert_string_keyword(format!("$P{index}S"), edit.secondary_name.clone());
            }
        }

        metadata.insert_string_keyword("$FIL".to_string(), output_name);
    })?;

    Ok(())
}

#[tauri::command]
fn get_cytometer_configs() -> ConfigBootstrap {
    ConfigBootstrap {
        default_config: "BD Fortessa 3L".to_string(),
        configs: cytometer_configs(),
    }
}

#[tauri::command]
fn load_fcs_inputs(paths: Vec<String>) -> std::result::Result<Vec<FcsFileRecord>, String> {
    expand_inputs(&paths)
        .and_then(|expanded| expanded.iter().map(|path| inspect_file(path)).collect())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn process_fcs_files(request: ProcessRequest) -> std::result::Result<ProcessResult, String> {
    let mut created_files = Vec::new();
    let mut warnings = Vec::new();

    for plan in &request.files {
        let source_path = PathBuf::from(&plan.path);
        let output_path = build_output_path(
            &source_path,
            &plan.output_base_name,
            request.keep_originals,
            request.output_directory.as_deref(),
        )
        .map_err(|error| error.to_string())?;

        let source = source_path
            .to_str()
            .ok_or_else(|| "Source path is not valid UTF-8".to_string())?;
        let fcs = Fcs::open(source).map_err(|error| error.to_string())?;
        apply_channel_template(fcs, &output_path, &request.channel_template)
            .map_err(|error| error.to_string())?;

        created_files.push(output_path.to_string_lossy().to_string());

        if request.output_directory.is_some()
            && source_path
                .parent()
                .map(|parent| parent != output_path.parent().unwrap_or(parent))
                .unwrap_or(false)
        {
            warnings.push(format!(
                "{} exported outside its original folder.",
                source_path.display()
            ));
        }
    }

    Ok(ProcessResult {
        created_files,
        warnings,
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("FCS Manager");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_cytometer_configs,
            load_fcs_inputs,
            process_fcs_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_file() -> PathBuf {
        PathBuf::from("../fcs/76_UT.fcs")
    }

    #[test]
    fn inspect_file_reads_channels_and_metadata() {
        let record = inspect_file(&sample_file()).expect("sample file should load");
        assert!(record.parameter_count > 0);
        assert!(!record.channels.is_empty());
        assert!(!record.parameters.is_empty());
    }

    #[test]
    fn export_creates_new_copy_and_preserves_original() {
        let source_path = sample_file();
        let original = inspect_file(&source_path).expect("sample file should load");
        let output_dir = tempdir().expect("temp dir should exist");
        let output_path = build_output_path(
            &source_path,
            "formatted_sample",
            true,
            Some(output_dir.path().to_str().expect("utf8 output dir")),
        )
        .expect("output path should be created");

        let first_channel = original
            .channels
            .first()
            .expect("sample file should have at least one channel");
        let edits = vec![ChannelEdit {
            original_primary_name: first_channel.original_primary_name.clone(),
            primary_name: format!("{}_RENAMED", first_channel.original_primary_name),
            secondary_name: "RenamedLabel".to_string(),
        }];

        let fcs = Fcs::open(source_path.to_str().expect("utf8 source")).expect("open sample");
        apply_channel_template(fcs, &output_path, &edits).expect("export should succeed");

        assert!(source_path.exists(), "original file must remain on disk");
        assert!(output_path.exists(), "exported file should exist");

        let exported = inspect_file(&output_path).expect("exported file should load");
        assert_eq!(
            exported.channels[0].primary_name,
            format!("{}_RENAMED", first_channel.original_primary_name)
        );
        assert_eq!(exported.channels[0].secondary_name, "RenamedLabel");
    }
}

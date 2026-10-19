export const RESULT_DISPLAY_PROFILES=Object.freeze({
  "AUTOMATED_BP_MONITOR": {
    "code": "AUTOMATED_BP_MONITOR",
    "renderer": "BP_CYCLE",
    "screenTitle": "Automated Bp Monitor",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/dispbp.js"
      },
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "BODY_COMPOSITION_ANALYZER": {
    "code": "BODY_COMPOSITION_ANALYZER",
    "renderer": "BODY_COMPOSITION",
    "screenTitle": "Body Composition Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CAPNOMETER": {
    "code": "CAPNOMETER",
    "renderer": "CAPNOGRAM",
    "screenTitle": "Capnometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/dispetco.js"
      },
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorTracing.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CLINICAL_THERMOMETER": {
    "code": "CLINICAL_THERMOMETER",
    "renderer": "NUMERIC_VITAL",
    "screenTitle": "Clinical Thermometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "MEDICAL_SCALE": {
    "code": "MEDICAL_SCALE",
    "renderer": "NUMERIC_VITAL",
    "screenTitle": "Medical Scale",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "MULTIPARAMETER_PATIENT_MONITOR": {
    "code": "MULTIPARAMETER_PATIENT_MONITOR",
    "renderer": "PATIENT_MONITOR",
    "screenTitle": "Multiparameter Patient Monitor",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/displaymonitor.js"
      },
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorTracing.axaml"
      },
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "PULSE_OXIMETER": {
    "code": "PULSE_OXIMETER",
    "renderer": "PLETH",
    "screenTitle": "Pulse Oximeter",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/dispspo.js"
      },
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorTracing.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "STADIOMETER": {
    "code": "STADIOMETER",
    "renderer": "NUMERIC_VITAL",
    "screenTitle": "Stadiometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "ABPM_MONITOR": {
    "code": "ABPM_MONITOR",
    "renderer": "ABPM_TIMELINE",
    "screenTitle": "Abpm Monitor",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/dispbp.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DIGITAL_STETHOSCOPE": {
    "code": "DIGITAL_STETHOSCOPE",
    "renderer": "STETHOSCOPE_WAVE",
    "screenTitle": "Digital Stethoscope",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "digital-stethoscope",
        "path": "src/gui.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "ECG_12_LEAD": {
    "code": "ECG_12_LEAD",
    "renderer": "ECG_12",
    "screenTitle": "Ecg 12 Lead",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/ECGTracing.axaml"
      },
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/dispecg.js"
      },
      {
        "repoId": "wfdb-python",
        "path": "wfdb/io/record.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "ECG_HANDHELD_SINGLE_LEAD": {
    "code": "ECG_HANDHELD_SINGLE_LEAD",
    "renderer": "ECG_SINGLE",
    "screenTitle": "Ecg Handheld Single Lead",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/ECGTracing.axaml"
      },
      {
        "repoId": "training-monitor-app",
        "path": "TMS/static/javascript/dispecg.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "HOLTER_RECORDER": {
    "code": "HOLTER_RECORDER",
    "renderer": "HOLTER",
    "screenTitle": "Holter Recorder",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "brainflow",
        "path": "src/board_controller/playback_file_board.cpp"
      },
      {
        "repoId": "wfdb-python",
        "path": "wfdb/io/record.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "FULL_PFT_SYSTEM": {
    "code": "FULL_PFT_SYSTEM",
    "renderer": "PFT_CURVES",
    "screenTitle": "Full Pft System",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "open-spirometer",
        "path": "HomeSpiro/HomeSpiro.ino"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "PEAK_FLOW_METER": {
    "code": "PEAK_FLOW_METER",
    "renderer": "NUMERIC_VITAL",
    "screenTitle": "Peak Flow Meter",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "SPIROMETER": {
    "code": "SPIROMETER",
    "renderer": "PFT_CURVES",
    "screenTitle": "Spirometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "open-spirometer",
        "path": "HomeSpiro/HomeSpiro.ino"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "ULTRASOUND_CART": {
    "code": "ULTRASOUND_CART",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Ultrasound Cart",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "ULTRASOUND_HANDHELD": {
    "code": "ULTRASOUND_HANDHELD",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Ultrasound Handheld",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CT_SCANNER": {
    "code": "CT_SCANNER",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Ct Scanner",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "MAMMOGRAPHY_SYSTEM": {
    "code": "MAMMOGRAPHY_SYSTEM",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Mammography System",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "MRI_SCANNER": {
    "code": "MRI_SCANNER",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Mri Scanner",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "XRAY_FIXED_DR": {
    "code": "XRAY_FIXED_DR",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Xray Fixed Dr",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "XRAY_MOBILE_DR": {
    "code": "XRAY_MOBILE_DR",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Xray Mobile Dr",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "AUDIOMETER": {
    "code": "AUDIOMETER",
    "renderer": "AUDIOGRAM",
    "screenTitle": "Audiometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorTracing.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DIGITAL_OTOSCOPE": {
    "code": "DIGITAL_OTOSCOPE",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Digital Otoscope",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "TYMPANOMETER": {
    "code": "TYMPANOMETER",
    "renderer": "TYMPANOGRAM",
    "screenTitle": "Tympanometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "tymp",
        "path": "demo/demo.m"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "VIDEO_RHINOLARYNGOSCOPE": {
    "code": "VIDEO_RHINOLARYNGOSCOPE",
    "renderer": "WEBRTC_VIDEO",
    "screenTitle": "Video Rhinolaryngoscope",
    "moduleMode": "SOURCE_PORT_BROWSER_RUNTIME",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "AUTOREFRACTOR_KERATOMETER": {
    "code": "AUTOREFRACTOR_KERATOMETER",
    "renderer": "REFRACTION",
    "screenTitle": "Autorefractor Keratometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DIGITAL_SLIT_LAMP": {
    "code": "DIGITAL_SLIT_LAMP",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Digital Slit Lamp",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "FUNDUS_CAMERA": {
    "code": "FUNDUS_CAMERA",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Fundus Camera",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "retinagan",
        "path": "run_pipeline.py"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "TONOMETER": {
    "code": "TONOMETER",
    "renderer": "NUMERIC_VITAL",
    "screenTitle": "Tonometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "VISUAL_ACUITY_SYSTEM": {
    "code": "VISUAL_ACUITY_SYSTEM",
    "renderer": "VISUAL_ACUITY",
    "screenTitle": "Visual Acuity System",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "OPHTHALMIC_OCT": {
    "code": "OPHTHALMIC_OCT",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Ophthalmic Oct",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "oct-simulation",
        "path": "segmentation.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "VISUAL_FIELD_ANALYZER": {
    "code": "VISUAL_FIELD_ANALYZER",
    "renderer": "VISUAL_FIELD",
    "screenTitle": "Visual Field Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorTracing.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CORNEAL_TOPOGRAPHER": {
    "code": "CORNEAL_TOPOGRAPHER",
    "renderer": "CORNEAL_TOPOGRAPHY",
    "screenTitle": "Corneal Topographer",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "corneal-topography",
        "path": "polarplot3d.m"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "OPTICAL_BIOMETER": {
    "code": "OPTICAL_BIOMETER",
    "renderer": "OPTICAL_BIOMETRY",
    "screenTitle": "Optical Biometer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/MonitorNumeric.axaml"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CLINICAL_MACRO_CAMERA": {
    "code": "CLINICAL_MACRO_CAMERA",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Clinical Macro Camera",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DIGITAL_DERMATOSCOPE": {
    "code": "DIGITAL_DERMATOSCOPE",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Digital Dermatoscope",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "WOUND_IMAGING_CAMERA": {
    "code": "WOUND_IMAGING_CAMERA",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Wound Imaging Camera",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "SKIN_ANALYZER": {
    "code": "SKIN_ANALYZER",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Skin Analyzer",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DERM_LASER_CO2": {
    "code": "DERM_LASER_CO2",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Co2",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_ER_YAG": {
    "code": "DERM_LASER_ER_YAG",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Er Yag",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_ND_YAG_LONG_PULSE": {
    "code": "DERM_LASER_ND_YAG_LONG_PULSE",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Nd Yag Long Pulse",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_ND_YAG_Q_SWITCHED": {
    "code": "DERM_LASER_ND_YAG_Q_SWITCHED",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Nd Yag Q Switched",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_PICOSECOND": {
    "code": "DERM_LASER_PICOSECOND",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Picosecond",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_ALEXANDRITE": {
    "code": "DERM_LASER_ALEXANDRITE",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Alexandrite",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_DIODE": {
    "code": "DERM_LASER_DIODE",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Diode",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LASER_FRACTIONAL": {
    "code": "DERM_LASER_FRACTIONAL",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Laser Fractional",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_IPL": {
    "code": "DERM_IPL",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Ipl",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_RF_MONOPOLAR": {
    "code": "DERM_RF_MONOPOLAR",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Rf Monopolar",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_RF_BIPOLAR": {
    "code": "DERM_RF_BIPOLAR",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Rf Bipolar",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_RF_MICRONEEDLE": {
    "code": "DERM_RF_MICRONEEDLE",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Rf Microneedle",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_RF_ELECTROSURGERY": {
    "code": "DERM_RF_ELECTROSURGERY",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Rf Electrosurgery",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LOW_FREQUENCY_STIMULATOR": {
    "code": "DERM_LOW_FREQUENCY_STIMULATOR",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Low Frequency Stimulator",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_HIFU": {
    "code": "DERM_HIFU",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Hifu",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_LED_PHOTOTHERAPY": {
    "code": "DERM_LED_PHOTOTHERAPY",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Led Phototherapy",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DERM_CRYOSURGERY": {
    "code": "DERM_CRYOSURGERY",
    "renderer": "THERAPY_TRACE",
    "screenTitle": "Derm Cryosurgery",
    "moduleMode": "VDEV2_SAFETY_CUSTOM",
    "sourceAnchors": [],
    "syntheticOnly": true,
    "physicalActuationAllowed": false,
    "safety": "INTERLOCK_REQUIRED_SIMULATION_ONLY"
  },
  "DENTAL_INTRAORAL_XRAY": {
    "code": "DENTAL_INTRAORAL_XRAY",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Dental Intraoral Xray",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DENTAL_PANORAMIC_XRAY": {
    "code": "DENTAL_PANORAMIC_XRAY",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Dental Panoramic Xray",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DENTAL_CBCT": {
    "code": "DENTAL_CBCT",
    "renderer": "DICOM_OHIF",
    "screenTitle": "Dental Cbct",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "modality-emulator",
        "path": "src/handlers/dicom_handlers.py"
      },
      {
        "repoId": "ohif",
        "path": "extensions/cornerstone/src/index.tsx"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "INTRAORAL_CAMERA": {
    "code": "INTRAORAL_CAMERA",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Intraoral Camera",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "INTRAORAL_SCANNER": {
    "code": "INTRAORAL_SCANNER",
    "renderer": "VTK_MESH",
    "screenTitle": "Intraoral Scanner",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "vtk-js",
        "path": "Sources/IO/Geometry/STLReader/index.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "BLOOD_GAS_ANALYZER": {
    "code": "BLOOD_GAS_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Blood Gas Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CBC_ANALYZER": {
    "code": "CBC_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Cbc Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "COAGULATION_ANALYZER": {
    "code": "COAGULATION_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Coagulation Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CRP_ANALYZER": {
    "code": "CRP_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Crp Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "ELECTROLYTE_ANALYZER": {
    "code": "ELECTROLYTE_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Electrolyte Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "GLUCOSE_METER": {
    "code": "GLUCOSE_METER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Glucose Meter",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "HBA1C_ANALYZER": {
    "code": "HBA1C_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Hba1C Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "LIPID_ANALYZER": {
    "code": "LIPID_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Lipid Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "TROPONIN_ANALYZER": {
    "code": "TROPONIN_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Troponin Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "URINE_ANALYZER": {
    "code": "URINE_ANALYZER",
    "renderer": "LAB_TABLE",
    "screenTitle": "Urine Analyzer",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "py-medical-simulators",
        "path": "ASTM1394.py"
      },
      {
        "repoId": "py-medical-simulators",
        "path": "HL7.py"
      },
      {
        "repoId": "hmis-analyzer-simulator",
        "path": "Middleware/FormAnalyzer.cs"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "EEG_SYSTEM": {
    "code": "EEG_SYSTEM",
    "renderer": "EEG_MULTI",
    "screenTitle": "Eeg System",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "brainflow",
        "path": "src/board_controller/synthetic_board.cpp"
      },
      {
        "repoId": "wfdb-python",
        "path": "wfdb/io/record.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "EMG_NCS_SYSTEM": {
    "code": "EMG_NCS_SYSTEM",
    "renderer": "EMG_NCS",
    "screenTitle": "Emg Ncs System",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "brainflow",
        "path": "src/board_controller/synthetic_board.cpp"
      },
      {
        "repoId": "wfdb-python",
        "path": "wfdb/io/record.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "CTG_MONITOR": {
    "code": "CTG_MONITOR",
    "renderer": "CTG",
    "screenTitle": "Ctg Monitor",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "infirmary-integrated",
        "path": "II Simulator/Controls/EFMTracing.axaml"
      },
      {
        "repoId": "wfdb-python",
        "path": "wfdb/io/record.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "FETAL_DOPPLER": {
    "code": "FETAL_DOPPLER",
    "renderer": "FETAL_DOPPLER",
    "screenTitle": "Fetal Doppler",
    "moduleMode": "SOURCE_PORT_RESULT_UI",
    "sourceAnchors": [
      {
        "repoId": "digital-stethoscope",
        "path": "src/gui.py"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "DIGITAL_MICROSCOPE": {
    "code": "DIGITAL_MICROSCOPE",
    "renderer": "OSD_IMAGE",
    "screenTitle": "Digital Microscope",
    "moduleMode": "IMPORT_OR_RUN_COMPONENT",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      },
      {
        "repoId": "openseadragon",
        "path": "src/viewer.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  },
  "TELEEXAM_CAMERA": {
    "code": "TELEEXAM_CAMERA",
    "renderer": "WEBRTC_VIDEO",
    "screenTitle": "Teleexam Camera",
    "moduleMode": "SOURCE_PORT_BROWSER_RUNTIME",
    "sourceAnchors": [
      {
        "repoId": "webrtc-samples",
        "path": "src/content/getusermedia/gum/js/main.js"
      }
    ],
    "syntheticOnly": true,
    "physicalActuationAllowed": false
  }
});
export const RESULT_RENDERER_CODES=Object.freeze([...new Set(Object.values(RESULT_DISPLAY_PROFILES).map(x=>x.renderer))].sort());
export function resultDisplayProfile(code){const p=RESULT_DISPLAY_PROFILES[code];if(!p)throw new Error(`Missing result display profile ${code}`);return p;}

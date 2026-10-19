import React from 'react';
import type { ClinicalScreenSpec } from '../screenRegistry';
import { LoginScreen } from './LoginScreen';
import { PatientHomeScreen } from './PatientHomeScreen';
import { AppointmentScreen } from './AppointmentScreen';
import { ConsentScreen } from './ConsentScreen';
import { PrecheckScreen } from './PrecheckScreen';
import { LiveVisitScreen } from './LiveVisitScreen';
import { SiteDashboardScreen } from './SiteDashboardScreen';
import { ClinicianDashboardScreen } from './ClinicianDashboardScreen';
import { ViewerScreen } from './ViewerScreens';
import { GenericClinicalScreen } from './GenericClinicalScreen';
import { ApiBoundClinicalScreen } from './ApiBoundClinicalScreen';
import { Vdev2AcquisitionScreen } from './Vdev2AcquisitionScreen';

export function ClinicalScreenResolver({ screen }: { screen: ClinicalScreenSpec }) {
  switch(screen.code){
    case 'G01': return <LoginScreen/>;
    case 'P01': return <PatientHomeScreen/>;
    case 'P03': return <AppointmentScreen/>;
    case 'P05':
    case 'P06':
    case 'P08':
    case 'P09':
    case 'P12':
    case 'P18':
    case 'P19':
    case 'P21':
    case 'P22':
    case 'P23':
    case 'P24':
    case 'P26':
      return <ApiBoundClinicalScreen screen={screen}/>;
    case 'P07': return <ConsentScreen/>;
    case 'P13': return <PrecheckScreen/>;
    case 'P15': return <LiveVisitScreen/>;
    case 'S01': return <SiteDashboardScreen/>;
    case 'S09': return <PrecheckScreen/>;
    case 'S10': return <LiveVisitScreen/>;
    case 'S11':
    case 'S18':
      return <ApiBoundClinicalScreen screen={screen}/>;
    case 'S15':
      return <Vdev2AcquisitionScreen/>;
    case 'C01': return <ClinicianDashboardScreen/>;
    case 'C05': return <LiveVisitScreen clinician/>;
    case 'C06':
    case 'C14':
    case 'C15':
    case 'C17':
    case 'C20':
      return <ApiBoundClinicalScreen screen={screen}/>;
    case 'C08': return <ViewerScreen kind="ECG"/>;
    case 'C09': return <ViewerScreen kind="DICOM"/>;
    case 'C10': return <ViewerScreen kind="ULTRASOUND"/>;
    case 'C11': return <ViewerScreen kind="AUSCULTATION"/>;
    case 'C12': return <ViewerScreen kind="LAB"/>;
    default: return <GenericClinicalScreen screen={screen}/>;
  }
}

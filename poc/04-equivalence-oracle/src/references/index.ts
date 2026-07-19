import { ReactS1, ReactS2, ReactS3 } from './react';
import { SolidS1, SolidS2, SolidS3 } from './solid.solid';
export const reactReferences: Record<string, any>={'S1-render-once-locals':ReactS1,'S2-keyed-todo':ReactS2,'S3-event-form':ReactS3};
export const solidReferences: Record<string, any>={'S1-render-once-locals':SolidS1,'S2-keyed-todo':SolidS2,'S3-event-form':SolidS3};

import MarklessS1 from '../../05-enriched-ir/src/fixtures/s1-render-once.tsrx';
import MarklessS2 from '../../05-enriched-ir/src/fixtures/s2-keyed-todo.tsrx';
import MarklessS3 from '../../05-enriched-ir/src/fixtures/s3-event-form.tsrx';
import { RenderOnce as EmittedReactS1 } from '../../06-emit-react/generated/S1.jsx';
import { KeyedTodo as EmittedReactS2 } from '../../06-emit-react/generated/S2.jsx';
import { EventForm as EmittedReactS3 } from '../../06-emit-react/generated/S3.jsx';
import { RenderOnce as EmittedSolidS1 } from '../../07-emit-solid/generated/S1.jsx';
import { KeyedTodo as EmittedSolidS2 } from '../../07-emit-solid/generated/S2.jsx';
import { EventForm as EmittedSolidS3 } from '../../07-emit-solid/generated/S3.jsx';
import { ReactS1, ReactS2, ReactS3 } from '../../04-equivalence-oracle/src/references/react.tsx';
import { SolidS1, SolidS2, SolidS3 } from './references/solid.solid.jsx';

export const markless = { 'S1-render-once-locals': MarklessS1, 'S2-keyed-todo': MarklessS2, 'S3-event-form': MarklessS3 } as Record<string, any>;
export const emittedReact = { 'S1-render-once-locals': EmittedReactS1, 'S2-keyed-todo': EmittedReactS2, 'S3-event-form': EmittedReactS3 } as Record<string, any>;
export const emittedSolid = { 'S1-render-once-locals': EmittedSolidS1, 'S2-keyed-todo': EmittedSolidS2, 'S3-event-form': EmittedSolidS3 } as Record<string, any>;
export const reactReferences = { 'S1-render-once-locals': ReactS1, 'S2-keyed-todo': ReactS2, 'S3-event-form': ReactS3 } as Record<string, any>;
export const solidReferences = { 'S1-render-once-locals': SolidS1, 'S2-keyed-todo': SolidS2, 'S3-event-form': SolidS3 } as Record<string, any>;

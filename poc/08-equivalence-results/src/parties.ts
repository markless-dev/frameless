import MarklessS1Hidden from './wrappers/s1-hidden.app.tsrx';
import MarklessS1Visible from './wrappers/s1-visible.app.tsrx';
import MarklessS2 from './wrappers/s2.app.tsrx';
import MarklessS3 from './wrappers/s3.app.tsrx';
import MarklessDirectS1 from './fixtures/s1-render-once.tsrx';
import MarklessPlainS1 from './fixtures/s1-render-once-plain.tsrx';
import MarklessDirectS2 from './fixtures/s2-keyed-todo.tsrx';
import MarklessDirectS3 from './fixtures/s3-event-form.tsrx';
import { RenderOnce as EmittedReactS1 } from '../../06-emit-react/generated/S1.jsx';
import { KeyedTodo as EmittedReactS2 } from '../../06-emit-react/generated/S2.jsx';
import { EventForm as EmittedReactS3 } from '../../06-emit-react/generated/S3.jsx';
import { RenderOnce as EmittedSolidS1 } from '../../07-emit-solid/generated/S1.jsx';
import { KeyedTodo as EmittedSolidS2 } from '../../07-emit-solid/generated/S2.jsx';
import { EventForm as EmittedSolidS3 } from '../../07-emit-solid/generated/S3.jsx';
import { ReactS1, ReactS2, ReactS3 } from '../../04-equivalence-oracle/src/references/react.tsx';
import { SolidS1, SolidS2, SolidS3 } from '../../04-equivalence-oracle/src/references/solid.solid.tsx';

export const markless = {
  'S1-render-once-locals': MarklessDirectS1,
  'S2-keyed-todo': MarklessDirectS2,
  'S3-event-form': MarklessDirectS3,
} as Record<string, any>;
export const marklessFallbacks = {
  'S1-render-once-locals': { visible: MarklessS1Visible, hidden: MarklessS1Hidden },
  'S2-keyed-todo': MarklessS2,
  'S3-event-form': MarklessS3,
} as Record<string, any>;
export const marklessFinding6Fallback = MarklessPlainS1;
export const emittedReact = { 'S1-render-once-locals': EmittedReactS1, 'S2-keyed-todo': EmittedReactS2, 'S3-event-form': EmittedReactS3 } as Record<string, any>;
export const emittedSolid = { 'S1-render-once-locals': EmittedSolidS1, 'S2-keyed-todo': EmittedSolidS2, 'S3-event-form': EmittedSolidS3 } as Record<string, any>;
export const reactReferences = { 'S1-render-once-locals': ReactS1, 'S2-keyed-todo': ReactS2, 'S3-event-form': ReactS3 } as Record<string, any>;
export const solidReferences = { 'S1-render-once-locals': SolidS1, 'S2-keyed-todo': SolidS2, 'S3-event-form': SolidS3 } as Record<string, any>;

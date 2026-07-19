import { makeReactS2, makeReactS3 } from '../references/react';
export const mutants = [
  {id:'wrong-text',scenario:'S2-keyed-todo',channel:'dom',component:makeReactS2('wrong-text')},
  {id:'wrong-live-property',scenario:'S3-event-form',channel:'dom',component:makeReactS3('wrong-property')},
  {id:'omitted-callback',scenario:'S3-event-form',channel:'callback',component:makeReactS3('omit-callback')},
  {id:'reordered-callback',scenario:'S3-event-form',channel:'callback',component:makeReactS3('reorder-callback')},
  {id:'broken-key-identity',scenario:'S2-keyed-todo',channel:'identity',component:makeReactS2('index-key')},
  {id:'wrong-cancellation',scenario:'S3-event-form',channel:'callback',component:makeReactS3('missing-prevent-default')},
  {id:'duplicate-handler',scenario:'S2-keyed-todo',channel:'callback',component:makeReactS2('duplicate-handler')},
  {id:'timing',scenario:'S3-event-form',channel:'dom',component:makeReactS3('timing')},
] as const;

import { useRef, useState } from 'react';

type Trace = (name:string,payload:unknown,event?:Event)=>void;
export function ReactS1({label,multiplier,visible,onTrace}:{label:string;multiplier:number;visible:boolean;onTrace:Trace}) {
  const [count,setCount]=useState(()=>{onTrace('setup',{runs:1});return 1;});
  const derived=`${label}:${count*multiplier}`; const report=()=>onTrace('change',{count:count+1});
  if(!visible) return <p data-branch="hidden">hidden</p>;
  return <section data-scenario="s1"><output data-value="derived">{derived}</output><button data-action="increment" onClick={()=>{setCount(v=>v+1);report();}}>increment</button></section>;
}

type Todo={id:string;title:string;done:boolean};
type S2Mutation='index-key'|'wrong-text'|'duplicate-handler'|undefined;
export function makeReactS2(mutation?:S2Mutation) {
  return function ReactS2({seed,onTrace}:{seed:Todo[];onTrace:Trace}) {
    const [todos,setTodos]=useState(()=>structuredClone(seed)); const [draft,setDraft]=useState(''); const next=useRef(3);
    const emit=(name:string,payload:unknown,e?:Event)=>{onTrace(name,payload,e);if(mutation==='duplicate-handler'&&name==='toggle')onTrace(name,payload,e);};
    const edit=(id:string,title:string,e:Event)=>setTodos(old=>{const alias=old.find(x=>x.id===id)!;alias.title=title;emit('edit',{id,title},e);return [...old];});
    const complete=todos.filter(x=>x.done).length;
    return <section data-scenario="s2"><p data-count="complete">{mutation==='wrong-text'?complete+1:complete}/{todos.length}</p>
      <input data-action="new" value={draft} onInput={e=>setDraft(e.currentTarget.value)}/><button data-action="add" onClick={e=>{const item={id:`c${next.current++}`,title:draft,done:false};setTodos(v=>[...v,item]);setDraft('');emit('add',{id:item.id,title:item.title},e.nativeEvent);}}>add</button>
      {todos.length===0?<p data-empty="true">empty</p>:<ul>{todos.map((todo,index)=><li key={mutation==='index-key'?index:todo.id} data-oracle-row-key={todo.id}>
        <input data-edit={todo.id} value={todo.title} onInput={e=>edit(todo.id,e.currentTarget.value,e.nativeEvent)}/>
        <input type="checkbox" data-toggle={todo.id} checked={todo.done} onChange={e=>{const checked=e.currentTarget.checked;setTodos(v=>v.map(x=>x.id===todo.id?{...x,done:checked}:x));emit('toggle',{id:todo.id,checked},e.nativeEvent);}}/>
        <button data-remove={todo.id} onClick={e=>{setTodos(v=>v.filter(x=>x.id!==todo.id));emit('remove',{id:todo.id},e.nativeEvent);}}>remove</button></li>)}</ul>}
      <button data-action="reorder" onClick={e=>{setTodos(v=>[...v].reverse());emit('reorder',{order:[...todos].reverse().map(x=>x.id)},e.nativeEvent);}}>reorder</button>
      <button data-action="clear" onClick={e=>{setTodos([]);emit('clear',{count:todos.length},e.nativeEvent);}}>clear</button></section>;
  };
}
export const ReactS2=makeReactS2();

type S3Mutation='wrong-property'|'omit-callback'|'reorder-callback'|'missing-prevent-default'|'timing'|undefined;
export function makeReactS3(mutation?:S3Mutation) {
  return function ReactS3({initial,onTrace}:{initial:string;onTrace:Trace}) {
    const [text,setText]=useState(initial),[checked,setChecked]=useState(false),[writes,setWrites]=useState(0);
    const submit=(e:React.MouseEvent)=>{
      if(mutation!=='missing-prevent-default')e.preventDefault();
      const fire=()=>onTrace('submit',{text,checked,writes:2},e.nativeEvent);
      if(mutation==='reorder-callback') onTrace('bubble',{source:'synthetic'},e.nativeEvent);
      if(mutation==='timing') { const output=e.currentTarget.form!.querySelector('output')!; queueMicrotask(()=>{output.textContent='2';}); } else {setWrites(1);setWrites(2);}
      fire();
    };
    return <form data-scenario="s3" onClick={e=>{if((e.target as HTMLElement).dataset.action==='submit'&&mutation!=='reorder-callback')onTrace('bubble',{source:'form'},e.nativeEvent);}}>
      <input data-action="text" value={mutation==='wrong-property'?`${text}!`:text} onInput={e=>{setText(e.currentTarget.value);onTrace('text',{value:e.currentTarget.value},e.nativeEvent);}}/>
      <input type="checkbox" data-action="checked" checked={checked} onChange={e=>{setChecked(e.currentTarget.checked);if(mutation!=='omit-callback')onTrace('checked',{checked:e.currentTarget.checked},e.nativeEvent);}}/>
      <button type="button" data-action="submit" onClick={submit}>submit</button><output data-writes="true">{writes}</output>
      <span data-callback-marker="present"/></form>;
  };
}
export const ReactS3=makeReactS3();

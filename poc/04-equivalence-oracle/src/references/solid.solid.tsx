import { createSignal, For, Show } from 'solid-js';

type Trace=(name:string,payload:unknown,event?:Event)=>void;
export function SolidS1(props:{label:string;multiplier:number;visible:boolean;onTrace:Trace}) {
  const {label,multiplier,visible}=props; props.onTrace('setup',{runs:1}); const [count,setCount]=createSignal(1);
  const derived=()=>`${label}:${count()*multiplier}`; const report=(next:number)=>props.onTrace('change',{count:next});
  // Same rooted-branch contract as the React reference (markless root-branch finding).
  return <div data-s1-root="">{!visible
    ? <p data-branch="hidden">hidden</p>
    : <section data-scenario="s1"><output data-value="derived">{derived()}</output><button data-action="increment" onClick={()=>{const next=count()+1;setCount(next);report(next);}}>increment</button></section>}</div>;
}
type Todo={id:string;title:string;done:boolean};
export function SolidS2(props:{seed:Todo[];onTrace:Trace}) {
  const [todos,setTodos]=createSignal(structuredClone(props.seed));const [draft,setDraft]=createSignal('');let next=3;
  const edit=(id:string,title:string,e:Event)=>{const copy=[...todos()];const alias=copy.find(x=>x.id===id)!;alias.title=title;setTodos(copy);props.onTrace('edit',{id,title},e);};
  const row=(todo:Todo)=><li data-oracle-row-key={todo.id}>
    <input data-edit={todo.id} attr:value={todos() && todo.title} value={todos() && todo.title} onInput={e=>edit(todo.id,e.currentTarget.value,e)}/>
    <input type="checkbox" data-toggle={todo.id} checked={todo.done} onChange={e=>{const checked=e.currentTarget.checked;setTodos(v=>{const copy=[...v];copy.find(x=>x.id===todo.id)!.done=checked;return copy;});props.onTrace('toggle',{id:todo.id,checked},e);}}/>
    <button data-remove={todo.id} onClick={e=>{setTodos(v=>v.filter(x=>x.id!==todo.id));props.onTrace('remove',{id:todo.id},e);}}>remove</button></li>;
  return <section data-scenario="s2"><p data-count="complete">{todos().filter(x=>x.done).length}/{todos().length}</p>
    <input data-action="new" attr:value={draft()} value={draft()} onInput={e=>setDraft(e.currentTarget.value)}/><button data-action="add" onClick={e=>{const item={id:`c${next++}`,title:draft(),done:false};setTodos(v=>[...v,item]);setDraft('');props.onTrace('add',{id:item.id,title:item.title},e);}}>add</button>
    <Show when={todos().length===0} fallback={<ul><For each={todos()}>{row}</For></ul>}><><p data-empty="true">empty</p><ul/></></Show>
    <button data-action="reorder" onClick={e=>{const order=[...todos()].reverse();setTodos(order);props.onTrace('reorder',{order:order.map(x=>x.id)},e);}}>reorder</button>
    <button data-action="clear" onClick={e=>{const count=todos().length;setTodos([]);props.onTrace('clear',{count},e);}}>clear</button></section>;
}
export function SolidS3(props:{initial:string;onTrace:Trace}) {
  const [text,setText]=createSignal(props.initial),[checked,setChecked]=createSignal(false),[writes,setWrites]=createSignal(0);
  return <form data-scenario="s3" onClick={e=>{if((e.target as HTMLElement).dataset.action==='submit')props.onTrace('bubble',{source:'form'},e);}}>
    <input data-action="text" attr:value={text()} value={text()} onInput={e=>{setText(e.currentTarget.value);props.onTrace('text',{value:e.currentTarget.value},e);}}/>
    <input type="checkbox" data-action="checked" checked={checked()} onChange={e=>{setChecked(e.currentTarget.checked);props.onTrace('checked',{checked:e.currentTarget.checked},e);}}/>
    <button type="button" data-action="submit" onClick={e=>{e.preventDefault();setWrites(1);setWrites(2);props.onTrace('submit',{text:text(),checked:checked(),writes:2},e);}}>submit</button><output data-writes="true">{writes()}</output><span data-callback-marker="present"/></form>;
}

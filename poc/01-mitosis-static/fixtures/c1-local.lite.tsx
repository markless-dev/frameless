export default function LocalDeclaration(props: { name: string }) {
  const greeting = `Hello, ${props.name}!`;

  return <div>{greeting}</div>;
}

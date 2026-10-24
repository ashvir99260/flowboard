import { notFound } from 'next/navigation';

import { Playground } from './playground';

export default function PlaygroundPage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return <Playground />;
}

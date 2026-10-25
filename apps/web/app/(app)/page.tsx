import { HomeRedirect } from '../../src/features/auth/HomeRedirect';

export default function HomePage() {
  return (
    <main>
      <h1>Flowboard</h1>
      <p>Organize your work.</p>
      <HomeRedirect />
    </main>
  );
}

import { useEffect, useState } from 'preact/hooks';

const parse = () => window.location.hash.replace(/^#/, '') || '/';

/** Router por hash mínimo: sin dependencias, compatible con el botón atrás móvil. */
export function useHashRoute() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

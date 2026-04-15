// useT — translation hook
// Usage: const t = useT();  t('key')
import { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import translations from './translations';

const useT = () => {
  const ctx = useContext(AppContext);
  const lang = ctx?.lang || 'en';
  const dict = translations[lang] || translations.en;
  return (key) => dict[key] ?? key;
};

export default useT;

import { useState } from 'react';
import { Languages } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Shown once on the sign-in screen when the site language was auto-set from
 * the visitor's location (not an explicit pick) and is not English. Lets them
 * keep that language or switch to English — either choice becomes sticky, so
 * this never appears again.
 */
const LanguagePrompt = () => {
  const { t, language, languageSource, languageInfo, setLanguage, confirmLanguage } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const open = !dismissed && language !== 'en' && languageSource === 'auto';
  const nativeName = languageInfo.nativeName;

  const keep = () => {
    confirmLanguage();
    setDismissed(true);
  };
  const toEnglish = () => {
    setLanguage('en');
    setDismissed(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) keep(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
            <Languages className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>{t('langPrompt.title')}</DialogTitle>
          <DialogDescription>
            {t('langPrompt.body', { language: nativeName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={keep}>
            {t('langPrompt.keep', { language: nativeName })}
          </Button>
          <Button variant="outline" className="w-full" onClick={toEnglish}>
            {t('langPrompt.english')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LanguagePrompt;

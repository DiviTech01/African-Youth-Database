import { Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage, languageInfo } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs sm:text-sm"
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{languageInfo.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`flex items-center justify-between gap-3 ${
              language === lang.code ? 'bg-accent font-medium' : ''
            }`}
          >
            <span>
              {lang.nativeName}
              <span className="ml-2 text-xs text-muted-foreground">{lang.name}</span>
            </span>
            {language === lang.code && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;

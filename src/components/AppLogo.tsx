import React, { useState } from 'react';
import { TrendingUp, DollarSign, Sparkles } from 'lucide-react';
import appLogoImg from '../assets/images/finova_app_logo_1789320550545.jpg';

export interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full' | 'inline' | 'header';
  className?: string;
  showSubtitle?: boolean;
  lightText?: boolean;
}

export default function AppLogo({
  size = 'md',
  variant = 'icon',
  className = '',
  showSubtitle = false,
  lightText = false
}: AppLogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeDimensions = {
    xs: 'w-7 h-7 text-xs rounded-xl',
    sm: 'w-8 h-8 text-sm rounded-xl',
    md: 'w-10 h-10 text-base rounded-2xl',
    lg: 'w-14 h-14 text-xl rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-3xl'
  }[size];

  const iconInnerSize = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-10 h-10'
  }[size];

  // Visual icon emblem (using generated fintech 3D icon with high-res vector fallback)
  const renderIcon = () => {
    if (!imgError) {
      return (
        <div className={`relative overflow-hidden shadow-sm shrink-0 ring-1 ring-amber-300/40 ${sizeDimensions}`}>
          <img
            src={appLogoImg}
            alt="Finova Logo"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    // High-craft SVG fallback emblem if image fails
    return (
      <div 
        className={`relative overflow-hidden shrink-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 flex items-center justify-center shadow-md border border-amber-400/40 ring-2 ring-amber-300/20 ${sizeDimensions}`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 pointer-events-none" />
        <div className="relative flex items-center justify-center">
          <TrendingUp className={`${iconInnerSize} text-amber-400 stroke-[2.5]`} />
          <DollarSign className="w-2.5 h-2.5 text-emerald-400 absolute -bottom-0.5 -right-0.5 stroke-[3]" />
        </div>
      </div>
    );
  };

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{renderIcon()}</div>;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {renderIcon()}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black tracking-tight text-xl sm:text-2xl ${lightText ? 'text-white' : 'text-slate-950'}`}>
            Fin<span className="text-amber-500">ova</span>
          </span>
          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 tracking-wider ml-0.5 shadow-2xs">
            Pro
          </span>
        </div>
        {showSubtitle && (
          <p className={`text-[10.5px] font-bold tracking-wide mt-0.5 ${lightText ? 'text-amber-200/90' : 'text-slate-500'}`}>
            Control Financiero & Negocios
          </p>
        )}
      </div>
    </div>
  );
}

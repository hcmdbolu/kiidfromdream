import React from 'react';
import { StaffAndRolesManager } from './StaffAndRolesManager';

interface StaffManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffManagerModal: React.FC<StaffManagerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-50/50 rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] overflow-y-auto">
        <StaffAndRolesManager isModal={true} onCloseModal={onClose} />
      </div>
    </div>
  );
};

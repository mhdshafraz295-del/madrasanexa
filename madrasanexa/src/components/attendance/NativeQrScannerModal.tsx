import React from 'react';
import { CameraScannerView } from './CameraScannerView';

export interface NativeQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (payload: string, source: 'camera') => void;
  title?: string;
  contextBadge?: string;
  statsBadge?: string;
  disabled?: boolean;
}

export const NativeQrScannerModal: React.FC<NativeQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  contextBadge,
  statsBadge,
  disabled = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
      <CameraScannerView
        onScan={onScan}
        disabled={disabled}
        contextBadge={contextBadge}
        statsBadge={statsBadge}
        isModal={true}
        onClose={onClose}
        fullScreenEnabled={false}
      />
    </div>
  );
};

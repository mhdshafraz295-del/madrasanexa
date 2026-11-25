import React from 'react';
import { CameraScannerView, type ScanResultToast } from './CameraScannerView';

export interface NativeQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (payload: string, source: 'camera') => void;
  title?: string;
  contextBadge?: string;
  statsBadge?: string;
  disabled?: boolean;
  lastScanResult?: ScanResultToast | null;
}

export const NativeQrScannerModal: React.FC<NativeQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  contextBadge,
  statsBadge,
  disabled = false,
  lastScanResult,
}) => {
  if (!isOpen) return null;

  return (
    <CameraScannerView
      onScan={onScan}
      disabled={disabled}
      contextBadge={contextBadge}
      statsBadge={statsBadge}
      isModal={true}
      onClose={onClose}
      fullScreenEnabled={false}
      lastScanResult={lastScanResult}
    />
  );
};

'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx'; // İşte yeni Excel kütüphanemiz! PapaParse (CSV) tamamen gitti.

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
}

export default function FileUpload({ onDataLoaded }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(
          workbook.Sheets[firstSheetName]
        );

        onDataLoaded(jsonData);
      } catch (error) {
        console.error('Excel okunurken hata:', error);
        alert('Dosya okunurken bir hata oluştu.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 w-full">
      <h2 className="text-xl font-semibold text-blue-800 mb-4">
        Elektraweb Sayım Listesini Yükle
      </h2>
      <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors">
        {isUploading ? 'Yükleniyor...' : 'Excel Dosyası Seç (.xlsx)'}
        <input
          type="file"
          accept=".xlsx, .xls"
          className="hidden"
          onChange={handleFileUpload}
        />
      </label>
      <p className="mt-3 text-sm text-gray-500">
        Sadece güncel Elektraweb Excel (.xlsx) dosyasını seçin.
      </p>
    </div>
  );
}

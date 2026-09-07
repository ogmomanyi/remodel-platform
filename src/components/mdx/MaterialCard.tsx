import React from 'react';

interface MaterialCardProps {
  title: string;
  durability: string;
  maintenance?: string;
  image?: string;
  notes: string;
}

export const MaterialCard = ({ title, durability, maintenance, image, notes }: MaterialCardProps) => (
  <div className="border rounded-lg p-4 shadow-sm bg-white">
    <div className="h-40 bg-gray-200 rounded-md mb-4 flex items-center justify-center text-gray-500 overflow-hidden">
      {image ? <img src={image} alt={title} className="object-cover w-full h-full" /> : 'Image Placeholder'}
    </div>
    <h3 className="font-bold text-lg text-gray-800">{title}</h3>
    <p className="text-sm text-gray-600 mt-1"><strong>Durability:</strong> {durability}</p>
    {maintenance && <p className="text-sm text-gray-600 mt-1"><strong>Maintenance:</strong> {maintenance}</p>}
    <p className="text-sm text-gray-700 mt-2">{notes}</p>
  </div>
);

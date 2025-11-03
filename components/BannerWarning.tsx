import React from 'react';

const BannerWarning = ({ title }: { title: string }) => {
  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
      <p className="font-bold">{title}</p>
    </div>
  );
};

export default BannerWarning;

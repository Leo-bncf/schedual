import React from 'react';

export default function PageHeader({ title, description, actions, breadcrumb }) {
  return (
    <div className="mb-8">
      {breadcrumb && (
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="text-slate-300">/</span>}
              <span className={index === breadcrumb.length - 1 ? 'text-slate-900 font-medium' : 'hover:text-slate-700 cursor-pointer'}>
                {item}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 text-slate-500 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
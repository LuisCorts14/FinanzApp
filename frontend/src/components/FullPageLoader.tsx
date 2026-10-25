export default function FullPageLoader() {
  return (
    <div className="full-page-loader" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Cargando...</span>
    </div>
  );
}

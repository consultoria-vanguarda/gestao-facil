export default function SectionContainer({ id, className = '', children }) {
  return (
    <section id={id} className={`px-6 py-16 md:py-20 ${className}`.trim()}>
      <div className="mx-auto w-full max-w-6xl">
        {children}
      </div>
    </section>
  );
}

export default function GestaoUpLogo({ className = '' }) {
  return (
    <span
      className={`font-sans font-semibold tracking-[-0.045em] text-[#ECEAFF] ${className}`}
      style={{ fontFeatureSettings: '"ss01", "ss02", "cv11"' }}
    >
      Gest<span className="text-[#7C5CFF]">ã</span>o
      <span className="text-[#7C5CFF]">UP</span>
    </span>
  );
}

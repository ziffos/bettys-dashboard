export default function SkeletonBlock({ className = "" }) {
  return (
    <div className={`rounded-md animate-pulse bg-gray-700/50 ${className}`} />
  );
}

export default function ThisWeek({ appUser }) {
  const firstName = appUser?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="px-5 pt-8 pb-10">
      <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">This Week</p>
      <h2 className="font-display text-3xl font-light text-stone-800 leading-snug">
        Hey, {firstName}.
      </h2>
      <p className="text-stone-400 text-sm mt-2">Your weekly plan will live here.</p>
    </div>
  )
}

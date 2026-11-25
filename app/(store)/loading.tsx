export default function Loading(){
  return <div className="sf-hero sf-skeleton" aria-busy="true">
    <p className="sf-visually-hidden" role="status">Sahifa yuklanmoqda</p>
    <div className="sf-hero-copy" aria-hidden="true"><span/><span className="is-title"/><span/></div>
  </div>;
}

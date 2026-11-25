export default function Loading(){
  return <div className="sf-wrap sf-product" aria-busy="true">
    <p className="sf-visually-hidden" role="status">Mahsulot yuklanmoqda</p>
    <header className="sf-product-head sf-skeleton" aria-hidden="true"><span/><span className="is-title"/><span/></header>
    <div className="sf-buy sf-skeleton" aria-hidden="true"><div className="sf-gallery-frame"/><div className="sf-config"><span/><span/><span/></div></div>
  </div>;
}

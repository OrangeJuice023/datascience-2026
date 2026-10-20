/**
 * Metro turns an image into a module with a numeric id, and the image
 * components accept that number as a local source. The declarations below
 * give the mascot artwork that type.
 */
declare module '*.gif' {
  const asset: number;
  export default asset;
}

declare module '*.png' {
  const asset: number;
  export default asset;
}

import QRCode from "qrcode";

/** Server component: renders a QR code for `value` as an inline PNG data URI. */
export async function QrImage({
  value,
  size = 160,
}: {
  value: string;
  size?: number;
}) {
  const dataUrl = await QRCode.toDataURL(value, { margin: 1, width: size });
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="Verification QR code"
      className="rounded-md border border-black/10 bg-white p-1"
    />
  );
}

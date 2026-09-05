function neutralHelper() {
  return "Visible helper copy";
}

const neutralArrow = () => "Visible arrow copy";

function deadHelper() {
  return "Dead helper copy";
}

export function RawLocalHelper() {
  console.log(deadHelper());
  return (
    <>
      <p>{neutralHelper()}</p>
      <p>{neutralArrow()}</p>
    </>
  );
}

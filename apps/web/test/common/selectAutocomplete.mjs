export async function selectAutocomplete(input, label) {
  await input.click();
  await input.fill(label);
  await input.page().getByRole('option', { name: label, exact: true }).click();
}

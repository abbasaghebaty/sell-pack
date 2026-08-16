(function() {
  const priceInput = document.getElementById('calc-price');
  const percentInput = document.getElementById('calc-percent');
  const salesInput = document.getElementById('calc-sales');
  const perSaleOutput = document.getElementById('calc-per-sale');
  const totalOutput = document.getElementById('calc-total');

  function updateCalculator() {
    const price = +priceInput.value || 0;
    const percent = +percentInput.value || 0;
    const sales = +salesInput.value || 0;

    const perSale = price * percent / 100;
    const total = perSale * sales;

    perSaleOutput.textContent = formatPrice(perSale) + ' تومان';
    totalOutput.textContent = formatPrice(total) + ' تومان';
  }

  [priceInput, percentInput, salesInput].forEach(input => {
    input.addEventListener('input', updateCalculator);
  });

  updateCalculator();
})();
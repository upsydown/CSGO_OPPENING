### Project Structure

```
/knife-bank
│
├── index.html
├── bank.html
├── styles.css
└── script.js
```

### 1. `index.html` (Main Page)

This page will allow users to add knives to their bank.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knife Bank</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Knife Bank</h1>
        <div class="adder">
            <input id="knifeName" placeholder="Knife Name" />
            <input id="knifeImage" placeholder="Image URL" />
            <input id="knifePrice" type="number" placeholder="Price" />
            <button id="addKnifeBtn">Add Knife</button>
        </div>
        <h2>Your Knives</h2>
        <div id="knifeList" class="knife-list"></div>
        <button id="viewBankBtn">View Bank</button>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

### 2. `bank.html` (Bank Page)

This page will display the knives stored in the bank.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Knife Bank</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Your Knife Bank</h1>
        <div id="bankList" class="knife-list"></div>
        <button id="backBtn">Back to Main Page</button>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

### 3. `styles.css` (Styling)

Basic styling for the application.

```css
body {
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    margin: 0;
    padding: 20px;
}

.container {
    max-width: 600px;
    margin: auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.adder {
    margin-bottom: 20px;
}

input {
    width: calc(33.33% - 10px);
    padding: 10px;
    margin-right: 10px;
}

button {
    padding: 10px;
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

button:hover {
    background-color: #218838;
}

.knife-list {
    margin-top: 20px;
}

.knife-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}

.knife-item img {
    width: 50px;
    height: 50px;
    margin-right: 10px;
}
```

### 4. `script.js` (JavaScript Logic)

This script will handle adding knives to the bank and displaying them.

```javascript
let knifeBank = JSON.parse(localStorage.getItem('knifeBank')) || [];

document.getElementById('addKnifeBtn').addEventListener('click', () => {
    const name = document.getElementById('knifeName').value;
    const image = document.getElementById('knifeImage').value;
    const price = parseFloat(document.getElementById('knifePrice').value);

    if (name && image && !isNaN(price)) {
        const knife = { name, image, price };
        knifeBank.push(knife);
        localStorage.setItem('knifeBank', JSON.stringify(knifeBank));
        displayKnives();
        document.getElementById('knifeName').value = '';
        document.getElementById('knifeImage').value = '';
        document.getElementById('knifePrice').value = '';
    } else {
        alert('Please fill in all fields correctly.');
    }
});

function displayKnives() {
    const knifeList = document.getElementById('knifeList');
    knifeList.innerHTML = '';
    knifeBank.forEach((knife, index) => {
        const knifeItem = document.createElement('div');
        knifeItem.className = 'knife-item';
        knifeItem.innerHTML = `
            <img src="${knife.image}" alt="${knife.name}">
            <span>${knife.name} - $${knife.price.toFixed(2)}</span>
            <button onclick="removeKnife(${index})">Remove</button>
        `;
        knifeList.appendChild(knifeItem);
    });
}

function removeKnife(index) {
    knifeBank.splice(index, 1);
    localStorage.setItem('knifeBank', JSON.stringify(knifeBank));
    displayKnives();
}

document.getElementById('viewBankBtn').addEventListener('click', () => {
    window.location.href = 'bank.html';
});

// Bank Page Logic
if (window.location.pathname.endsWith('bank.html')) {
    const bankList = document.getElementById('bankList');
    knifeBank.forEach(knife => {
        const knifeItem = document.createElement('div');
        knifeItem.className = 'knife-item';
        knifeItem.innerHTML = `
            <img src="${knife.image}" alt="${knife.name}">
            <span>${knife.name} - $${knife.price.toFixed(2)}</span>
        `;
        bankList.appendChild(knifeItem);
    });

    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Initial display of knives
if (window.location.pathname.endsWith('index.html')) {
    displayKnives();
}
```

### Explanation

1. **HTML Structure**: The project consists of two main pages: the main page (`index.html`) where users can add knives and the bank page (`bank.html`) where users can view their stored knives.

2. **CSS Styling**: Basic styles are applied to make the application visually appealing.

3. **JavaScript Logic**:
   - Knives are stored in the browser's `localStorage` to persist data between sessions.
   - Users can add knives by entering their name, image URL, and price.
   - The knives are displayed in a list, and users can remove knives from the list.
   - The bank page displays all knives stored in the bank.

### How to Run the Project

1. Create a folder named `knife-bank`.
2. Inside the folder, create the files as per the structure above.
3. Open `index.html` in a web browser to start using the application.

This project can be further enhanced with features like editing knife details, sorting, filtering, and more.
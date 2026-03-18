

1. Should have an ADD feature - don't let vic not add a new custom field, add it to database
2. Save database to YAML file
3. Send to email feature - add button to share: download or email.
4. data.yaml - a 'database' but its just a local file thats downloaded
5. when a new entry is added, it will 
6. A field at the bottom for changing the price. You can click into the % box or the $ box and both will react accordingly
    * Unadjusted total: [ total ]
    * Value %: [ (default 100%) ]
    * Value Total: [ (default total) ]
7. Button at bottom: Send email: [ enter email ] - default subject "VicsTakeoff" - populates email automatically.
8. Button at bottom: download
9. 'Hide column' option
10. 'Hide row' option
    11. (low priority) Any time a default isn't selected, attempt to add it to the database if the entry does not already exist.


Payload:
* data.yaml - updated 'database'
* data.yaml schema:
    * locations: [] - list of locations to select from.
    * categories: [] - list of categories to select from.
    * worktypes: [] - ADD NEW, ADD OWNER PROVIDED, REMOVE, DELETE, REPLACE WITH EXISTING, REPLACE WITH NEW,
    * materials: [] - 4" recessed light, panel and breakers, circuit, old fixture,
    * price: [] - an attribute of materials
* takeoff.yaml
    * locations: []
    * categories: []
    * worktypes: [] - ADD NEW, ADD OWNER PROVIDED, REMOVE, DELETE, REPLACE WITH EXISTING, REPLACE WITH NEW,
    * materials: [] - 4" recessed light, panel and breakers, circuit, old fixture,
    * description: [] - Auto populated as part of worktype + material, but can be edited
    * quantity: [] - default 1
    * price: [] - an attribute of materials


Alright. So MVP: 
* We will have a database of lists to be used in a multi-select/custom select dropdown. I will create this using AI scraping much data from excel files, asking it to fit options into the data.yaml file.
* We will have a frontend with no login:
    * User will have several columns. Each column will be a search multiselect/type custom system.
    * User will add a new row one by one
    * Four main sections: Customer information, data entry, totals adjustment, and send data.


Prompt:
* Create a new github pages app. 
* INPUT: User inputs various fields like a form via several typing fields that have a dropdown feature showing the best 1:1 character matches, no lazy matching.
* OUTPUT: User presses send button. When the button is clicked, all of the fields in the form that were filled out is turned into a text file and automatically populated into the email field and subject. User is not provided a default email to send to and must write it out themselves.
* General Description of problem: A business owner named Vic, who owns an electric company, wants to make material takeoff/scope of work building/estimate building way easier. Currently, he uses excel, but wants to upgrade. He wants an app. This app will take his manual typing the following fields in excel: 'Description (containing quantity, material, add/remove/replace specifier, and more)', 'Price (quantity * unit price)' and at the bottom 'total (which is a combination of all line items total price added together)'. 
* General description of solution: The best github app would contain the following sections - Line item entry table, totals adjustment and overview section, job details section (including customer name, work address, business name, business address, emails and phonenumbers), and a 'export' section where a user can click to open their default email app in the browser automatically.
* Identity: You are a frontend github pages expert. You know in detail all the docs by heart from github pages. 

* Some important implementation details:
    * EVERY field that can be selected from dropdown-style can also be typed into manually.
    * As the user manually types, they will get an exact post-lowercasing character match alphabetically ordered options that match for them. This should function almost identical to google web search, except the user can select from a dropdown also.
    * The options in the dropdowns will ALL be loaded into a type of yaml/json file. If the user begins typing, the field name associated with the json field name present directly in the project files will be used. for example: when data.json = {room_name: ['kitchen', 'lanai', 'master bathroom', 'guest bathroom'],  category: [...], ...} a user will type into a cell/entry for the room_name column: 'bath' and the options selectable will allow him to keep typing or show 'master bathroom' and 'guest bathroom' as the dropdown options he can click or down arrow key into.
    * In the totals section, there should be 3 boxes: 'base item total' (cannot be typed into, is a sum of all line item final prices), 'Final Total' (shows an editable field, no dropdown, default entry is value of 'base item total' but can be increased or decreased, adjusts % from base item total ), 'percent from base total' (default 100%, but allows a user to change it to 200% or 50% for example. 'Final total' will mutually mirror and sync with 'percent from base total' )
    * when the user clicks 'export' in the export section, a YAML or JSON file will be produced. The user's default email will open up and the YAML/JSON export will be added as an attachment. A default email will not be provided. The default subject will be 'Vic's takeoff' and the default message will be 'Hello, I just made a takeoff for {work address} using Vic's Takeoff please see attached.'
    * Should be hosted on some free source, ideally github pages
    * Generate a data.json for me. You will populate these fields in this structure: {room, category, {material, price}, description, worktype}
    * example: 'room: kitchen', category: 'speakers', worktype: 'ADD NEW', quantity: '1', material: '20" speaker with surround sound sonos system', 'price: 2000', description: 'Add 1 new 20" speaker with surrround sound sonos system'
    * Dropdown selection should only autopopulate after at least 2 characters are written



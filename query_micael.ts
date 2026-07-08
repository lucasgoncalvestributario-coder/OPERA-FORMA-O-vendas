import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

async function run() {
  const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  
  admin.initializeApp({
    projectId: config.projectId,
  });

  const db = getFirestore(admin.app(), config.firestoreDatabaseId);

  console.log("--- FETCHING USERS ---");
  const usersSnap = await db.collection("users").get();
  const allUsers: any[] = [];
  usersSnap.forEach(doc => {
    allUsers.push({ id: doc.id, ...doc.data() });
  });

  const micaelUsers = allUsers.filter(u => {
    const name = (u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes("micael") || email.includes("micael");
  });

  console.log("Found Micael Users:", JSON.stringify(micaelUsers, null, 2));

  console.log("\n--- FETCHING ALL SALES ---");
  const salesSnap = await db.collection("sales").get();
  const allSales: any[] = [];
  salesSnap.forEach(doc => {
    allSales.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Total Sales in DB: ${allSales.length}`);

  const renataSales = allSales.filter(s => s.vendorId === "ext_renata");
  console.log("Renata POA Sales in DB:", JSON.stringify(renataSales, null, 2));

  console.log("\n--- FETCHING ALL CONTRACTS ---");
  const contractsSnap = await db.collection("contracts").get();
  const allContracts: any[] = [];
  contractsSnap.forEach(doc => {
    allContracts.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Total Contracts in DB: ${allContracts.length}`);
  const micaelContracts = allContracts.filter(c => {
    const vName = (c.vendorName || "").toLowerCase();
    const cons = (c.consultant || "").toLowerCase();
    const vId = c.vendorId || "";
    const isMicaelUserId = micaelUsers.some(mu => mu.id === vId);
    return vName.includes("micael") || cons.includes("micael") || isMicaelUserId;
  });

  console.log("\nFound Micael Contracts:", JSON.stringify(micaelContracts, null, 2));

  process.exit(0);
}

run().catch((err) => {
  console.error("Error running admin query script:", err);
  process.exit(1);
});

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseDatabase, getFirebaseStorage } from "../../lib/firebase";
import classmatesIcon from "../../asset/classmatesicon.png";
import overviewIcon from "../../asset/overviewIcon.png";
import experiencesIcon from "../../asset/experiencesIcon.png";
import resourcesIcon from "../../asset/resourcesIcon.png";
import flagReportsIcon from "../../asset/flagreportsIcon.png";
import settingsIcon from "../../asset/Vector (1).png";
import styles from "./dashboard.module.css";

const menuItems = [
  [overviewIcon, "Overview"],
  [experiencesIcon, "Experiences"],
  [resourcesIcon, "Resources"],
  [flagReportsIcon, "Flag reports"],
  [settingsIcon, "Settings"],
];

export default function DashboardPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [counts, setCounts] = useState({
    users: "—",
    posts: "—",
    postReports: "—",
    connectionReports: "—",
  });
  const [topExperiences, setTopExperiences] = useState([]);
  const [topResources, setTopResources] = useState([]);
  const [dataNotice, setDataNotice] = useState("");
  const [experienceType, setExperienceType] = useState(null);
  const [experienceGuidance, setExperienceGuidance] = useState("Self-led");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [experienceSaving, setExperienceSaving] = useState(false);
  const [experienceSaveStep, setExperienceSaveStep] = useState("");
  const [experienceError, setExperienceError] = useState("");
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceFile, setResourceFile] = useState(null);
  const [resourceSaving, setResourceSaving] = useState(false);
  const [resourceSaveStep, setResourceSaveStep] = useState("");
  const [resourceError, setResourceError] = useState("");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();

      if (!user || user.email?.toLowerCase() !== adminEmail) {
        router.replace("/");
        return;
      }

      setCheckingAuth(false);

      try {
        const database = getFirebaseDatabase();
        const countCollections = ["users", "posts", "postReports", "connectionReports"];
        const [countResults, contentResults] = await Promise.all([
          Promise.allSettled(
            countCollections.map((collectionName) =>
              getCountFromServer(collection(database, collectionName))
            )
          ),
          Promise.allSettled([
            getDocs(query(collection(database, "experiences"), orderBy("createdAt", "desc"), limit(6))),
            getDocs(query(collection(database, "resources"), orderBy("createdAt", "desc"), limit(6))),
          ]),
        ]);

        const nextCounts = {
          users: "—",
          posts: "—",
          postReports: "—",
          connectionReports: "—",
        };
        countResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            nextCounts[countCollections[index]] = result.value.data().count.toLocaleString();
          }
        });
        setCounts(nextCounts);

        if (countResults.some((result) => result.status === "rejected")) {
          setDataNotice("Some counts are protected by Firestore rules. Admin read permission is required.");
        }

        if (contentResults[0].status === "fulfilled") {
          setTopExperiences(
            contentResults[0].value.docs.map((document) => ({ id: document.id, ...document.data() }))
          );
        }
        if (contentResults[1].status === "fulfilled") {
          setTopResources(
            contentResults[1].value.docs.map((document) => ({ id: document.id, ...document.data() }))
          );
        }
      } catch {
        setDataNotice("Some database data could not be loaded. Admin Firestore permissions are required.");
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.replace("/");
  }

  function openExperienceForm(type) {
    setExperienceGuidance("Self-led");
    setExperienceType(type);
  }

  function closeExperienceForm() {
    setExperienceType(null);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    setThumbnailUrl("");
    setThumbnailFile(null);
    setExperienceError("");
    setExperienceSaveStep("");
    setExperienceGuidance("Self-led");
  }

  function handleThumbnail(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setExperienceError("");

    if (!file.type.startsWith("image/")) {
      setExperienceError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size >= 10 * 1024 * 1024) {
      setExperienceError("The thumbnail must be smaller than 10MB.");
      event.target.value = "";
      return;
    }

    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    setThumbnailFile(file);
    setThumbnailUrl(URL.createObjectURL(file));
  }

  async function handleCreateExperience(event) {
    event.preventDefault();
    setExperienceSaving(true);
    setExperienceError("");
    setExperienceSaveStep(thumbnailFile ? "Uploading thumbnail..." : "Saving experience...");

    try {
      const formData = new FormData(event.currentTarget);
      let uploadedThumbnailUrl = "";

      if (thumbnailFile) {
        const safeFileName = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const storageReference = ref(
          getFirebaseStorage(),
          `experiences/${Date.now()}-${safeFileName}`
        );
        const uploadTask = uploadBytes(storageReference, thumbnailFile, {
          contentType: thumbnailFile.type,
        });
        const uploadResult = await Promise.race([
          uploadTask,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("storage-timeout")), 20000)
          ),
        ]);
        uploadedThumbnailUrl = await getDownloadURL(uploadResult.ref);
      }

      setExperienceSaveStep("Saving experience...");
      const isFree = formData.get("isFree") === "Yes";
      await addDoc(collection(getFirebaseDatabase(), "experiences"), {
        type: formData.get("guidanceType"),
        guidanceType: formData.get("guidanceType"),
        category: formData.get("category"),
        subject: formData.get("subject"),
        name: formData.get("name").trim(),
        schedule: formData.get("schedule").trim(),
        location: formData.get("location").trim(),
        hostedBy: formData.get("hostedBy").trim(),
        description: formData.get("description").trim(),
        ageRange: formData.get("ageRange"),
        environment: formData.get("environment"),
        isFree,
        price: isFree ? 0 : Number(formData.get("price") || 0),
        bookingLink: formData.get("bookingLink")?.trim() || "",
        thumbnailUrl: uploadedThumbnailUrl,
        status: "published",
        createdBy: getFirebaseAuth().currentUser?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      closeExperienceForm();
      setDataNotice("Experience created successfully. It is now available to the mobile app.");
    } catch (error) {
      setExperienceError(
        error.message === "storage-timeout"
          ? "Thumbnail upload timed out. Check that Firebase Storage is enabled and its rules are published."
          : error.code === "storage/unauthorized"
          ? "Thumbnail upload was denied. Confirm the Storage rules are published, the image is under 10MB, and you are logged in with the configured admin email."
          : error.code?.startsWith("storage/")
            ? `Thumbnail upload failed: ${error.code}. Check Firebase Storage setup.`
          : error.code === "permission-denied"
            ? "Firebase blocked this save. Publish the updated Firestore rules first."
            : "Unable to create the experience. Please try again."
      );
    } finally {
      setExperienceSaving(false);
      setExperienceSaveStep("");
    }
  }

  function closeResourceForm() {
    setResourceModalOpen(false);
    setResourceFile(null);
    setResourceError("");
    setResourceSaveStep("");
  }

  function handleResourceFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setResourceError("");

    if (file.type !== "application/pdf") {
      setResourceError("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size >= 20 * 1024 * 1024) {
      setResourceError("The PDF must be smaller than 20MB.");
      event.target.value = "";
      return;
    }

    setResourceFile(file);
  }

  async function handleCreateResource(event) {
    event.preventDefault();
    if (!resourceFile) {
      setResourceError("Please select a PDF file.");
      return;
    }

    setResourceSaving(true);
    setResourceError("");
    setResourceSaveStep("Uploading PDF...");

    try {
      const formData = new FormData(event.currentTarget);
      const safeFileName = resourceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storageReference = ref(
        getFirebaseStorage(),
        `resources/${Date.now()}-${safeFileName}`
      );
      const uploadResult = await Promise.race([
        uploadBytes(storageReference, resourceFile, { contentType: "application/pdf" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("storage-timeout")), 30000)
        ),
      ]);
      const pdfUrl = await getDownloadURL(uploadResult.ref);

      setResourceSaveStep("Saving resource...");
      const resourceDocument = {
        title: formData.get("title").trim(),
        name: formData.get("title").trim(),
        subject: formData.get("subject"),
        pages: Number(formData.get("pages")),
        ageRange: formData.get("ageRange"),
        keyStage: formData.get("keyStage"),
        pdfUrl,
        fileName: resourceFile.name,
        status: "published",
        createdBy: getFirebaseAuth().currentUser?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const createdResource = await addDoc(
        collection(getFirebaseDatabase(), "resources"),
        resourceDocument
      );

      setTopResources((items) => [
        { id: createdResource.id, ...resourceDocument },
        ...items,
      ].slice(0, 6));
      closeResourceForm();
      setDataNotice("Resource created successfully. It is now available to the mobile app.");
    } catch (error) {
      setResourceError(
        error.message === "storage-timeout"
          ? "PDF upload timed out. Please check your connection and try again."
          : error.code === "storage/unauthorized"
            ? "PDF upload was denied. Publish the latest Firebase Storage rules."
            : error.code === "permission-denied"
              ? "Firebase blocked this save. Publish the latest Firestore rules."
              : "Unable to create the resource. Please try again."
      );
    } finally {
      setResourceSaving(false);
      setResourceSaveStep("");
    }
  }

  if (checkingAuth) {
    return <main className={styles.loading}>Checking admin access...</main>;
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <span className={styles.logo}>CLASSMATES</span>
        <div className={styles.headerActions}>
          <button
            className={styles.createAction}
            type="button"
            onClick={() => openExperienceForm("Place")}
          >
            Add an experience <span>+</span>
          </button>
          <button className={styles.createAction} type="button" onClick={() => setResourceModalOpen(true)}>
            Add a resource <span>+</span>
          </button>
          <button className={styles.logoutButton} onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav>
          {menuItems.map(([icon, label], index) => (
            <button className={index === 0 ? styles.activeMenu : ""} key={label}>
              <span><Image src={icon} alt="" /></span>{label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarArt}>
          <Image src={classmatesIcon} alt="Classmates together" priority />
        </div>
      </aside>

      <section className={styles.content}>
        <div className={styles.titleBand}>
          <p>Admin dashboard</p>
          <h1>Overview</h1>
        </div>

        {dataNotice && <p className={styles.notice}>{dataNotice}</p>}

        <div className={styles.stats}>
          <article><span>Total users</span><strong>{counts.users}</strong><small>Live from Firebase</small></article>
          <article><span>Total posts</span><strong>{counts.posts}</strong><small>Live from Firebase</small></article>
          <article><span>Post reports</span><strong>{counts.postReports}</strong><small>Live from Firebase</small></article>
          <article><span>Connection reports</span><strong>{counts.connectionReports}</strong><small>Live from Firebase</small></article>
        </div>

        <div className={styles.panels}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2>Top Experiences right now</h2>
              <span>Latest experiences</span>
            </div>
            {topExperiences.length ? (
              <ol className={styles.list}>
                {topExperiences.map((experience) => (
                  <li key={experience.id}>
                    {experience.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.itemThumbnail} src={experience.thumbnailUrl} alt="" />
                    ) : (
                      <span className={styles.itemPlaceholder} />
                    )}
                    <div>
                      <strong>{experience.name || "Untitled experience"}</strong>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.empty}>No experiences to display yet.</div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2>Top Resources right now</h2>
              <span>Latest resources</span>
            </div>
            {topResources.length ? (
              <ol className={styles.list}>
                {topResources.map((resource) => (
                  <li key={resource.id}>
                    {resource.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.itemThumbnail} src={resource.thumbnailUrl} alt="" />
                    ) : (
                      <span className={styles.itemPlaceholder} />
                    )}
                    <div>
                      <strong>{resource.name || resource.title || "Untitled resource"}</strong>
                      <p>{resource.subject || resource.type || "Resource"}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.empty}>No resources to display yet.</div>
            )}
          </article>
        </div>
      </section>

      {experienceType && (
        <div className={styles.modalOverlay} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="experience-title">
            {experienceSaving && (
              <div className={styles.savingOverlay} role="status" aria-live="polite">
                <span className={styles.spinner} />
                <strong>{experienceSaveStep}</strong>
                <small>Please wait while your experience is being created.</small>
              </div>
            )}
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <h2 id="experience-title">Create new experience</h2>
                <select name="category" form="experience-form" aria-label="Experience category" defaultValue="" required>
                  <option value="" disabled>Select category</option>
                  <option>Museums</option>
                  <option>Workshops</option>
                  <option>Nature</option>
                  <option>Arts</option>
                  <option>STEM</option>
                  <option>Sport</option>
                  <option>Culture</option>
                  <option>Other</option>
                </select>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeExperienceForm}>Close</button>
            </div>

            <form id="experience-form" className={styles.experienceForm} onSubmit={handleCreateExperience}>
              <label>
                <span>Experience name</span>
                <input name="name" required placeholder={experienceType === "Place" ? "eg. Natural History Museum" : "eg. Science discovery workshop"} />
              </label>
              <label>
                <span>{experienceType === "Place" ? "Hours" : "Date & time"}</span>
                <input name="schedule" required placeholder={experienceType === "Place" ? "Mon - Friday 10am - 5pm" : "Saturday 10am - 2pm"} />
              </label>
              <label>
                <span>{experienceType === "Place" ? "Location link" : "Location"}</span>
                <input name="location" required placeholder={experienceType === "Place" ? "Paste map or website link" : "Type in location"} />
              </label>
              <label>
                <span>Hosted by</span>
                <input name="hostedBy" required placeholder="Name of organisation/company" />
              </label>
              <label>
                <span>Experience type</span>
                <select
                  name="guidanceType"
                  required
                  value={experienceGuidance}
                  onChange={(event) => setExperienceGuidance(event.target.value)}
                >
                  <option value="Guided">Guided</option>
                  <option value="Self-led">Self-led</option>
                </select>
              </label>
              <label>
                <span>Subject</span>
                <select name="subject" defaultValue="" required>
                  <option value="" disabled>Select a subject</option>
                  <option>Maths</option>
                  <option>English</option>
                  <option>Science</option>
                  <option>History</option>
                  <option>Geography</option>
                  <option>Art</option>
                  <option>Computing</option>
                  <option>Religious</option>
                  <option>Music</option>
                  <option>Languages</option>
                  <option>Life Skills</option>
                  <option>P.E</option>
                </select>
              </label>
              <label className={styles.descriptionField}>
                <span>{experienceGuidance === "Guided" ? "What to expect" : "Try this while you're there"}</span>
                <textarea
                  name="description"
                  required
                  placeholder={experienceGuidance === "Guided" ? "Add bullet points describing what to expect." : "Add bullet points for things families can try while they are there."}
                />
              </label>
              <label className={styles.uploadField}>
                <input type="file" accept="image/*" onChange={handleThumbnail} />
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="Experience thumbnail preview" />
                ) : (
                  <span>Click to upload thumbnail</span>
                )}
              </label>

              <div className={styles.formOptions}>
                <label><span>Recommended age</span><select name="ageRange" required defaultValue=""><option value="" disabled>Select age</option><option>2-4 years</option><option>5-7 years</option><option>8-11 years</option><option>12-18 years</option><option>All ages</option></select></label>
                <label><span>Indoor/Outdoor</span><select name="environment" required defaultValue=""><option value="" disabled>Select</option><option>Indoor</option><option>Outdoor</option><option>Both</option></select></label>
                <label><span>Is it free?</span><select name="isFree" required defaultValue=""><option value="" disabled>Select</option><option>Yes</option><option>No</option></select></label>
                <label><span>Price</span><input name="price" type="number" min="0" step="0.01" placeholder="£00.00" /></label>
                <label><span>Booking Link</span><input name="bookingLink" type="url" placeholder="Paste booking link for book CTA" /></label>
              </div>

              {experienceError && <p className={styles.experienceError} role="alert">{experienceError}</p>}
              <button className={styles.submitExperience} type="submit" disabled={experienceSaving}>
                {experienceSaving ? experienceSaveStep : "Create experience"}
              </button>
            </form>
          </section>
        </div>
      )}

      {resourceModalOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <section className={`${styles.modal} ${styles.resourceModal}`} role="dialog" aria-modal="true" aria-labelledby="resource-title">
            {resourceSaving && (
              <div className={styles.savingOverlay} role="status" aria-live="polite">
                <span className={styles.spinner} />
                <strong>{resourceSaveStep}</strong>
                <small>Please wait while your resource is being created.</small>
              </div>
            )}

            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <h2 id="resource-title">Upload a resource</h2>
                <select name="subject" form="resource-form" aria-label="Resource subject category" defaultValue="" required>
                  <option value="" disabled>Select subject category</option>
                  <option>Museums</option>
                  <option>Workshops</option>
                  <option>Nature</option>
                  <option>Arts</option>
                  <option>STEM</option>
                  <option>Sport</option>
                  <option>Culture</option>
                  <option>Other</option>
                </select>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeResourceForm}>Close</button>
            </div>

            <form id="resource-form" className={styles.resourceForm} onSubmit={handleCreateResource}>
              <div className={styles.resourceFields}>
                <label>
                  <span>Resource title</span>
                  <input name="title" required placeholder="e.g. Vikings: Raiders, Traders & Explorers" />
                </label>
                <label>
                  <span>Age</span>
                  <select name="ageRange" required defaultValue="">
                    <option value="" disabled>Select age</option>
                    <option>3-5</option>
                    <option>5-7</option>
                    <option>7-11</option>
                    <option>11-14</option>
                    <option>14-18</option>
                    <option>All ages</option>
                  </select>
                </label>
                <label>
                  <span>Key Stage</span>
                  <select name="keyStage" required defaultValue="">
                    <option value="" disabled>Select key stage</option>
                    <option>Early Years</option>
                    <option>Key Stage 1</option>
                    <option>Key Stage 2</option>
                    <option>Key Stage 3</option>
                    <option>Key Stage 4</option>
                    <option>Post-16</option>
                  </select>
                </label>
              </div>

              <div className={styles.resourceSide}>
                <label>
                  <span>Pages</span>
                  <input name="pages" type="number" min="1" required placeholder="1" />
                </label>
                <label className={styles.pdfUploadField}>
                  <input type="file" accept="application/pdf,.pdf" onChange={handleResourceFile} />
                  <span>{resourceFile ? resourceFile.name : "Click to upload PDF"}</span>
                </label>
              </div>

              {resourceError && <p className={styles.resourceError} role="alert">{resourceError}</p>}
              <button className={styles.submitExperience} type="submit" disabled={resourceSaving}>
                {resourceSaving ? resourceSaveStep : "Create resource"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

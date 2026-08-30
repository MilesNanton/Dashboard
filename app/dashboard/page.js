"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseDatabase, getFirebaseStorage } from "../../lib/firebase";
import classmatesIcon from "../../asset/classmatesicon.png";
import overviewIcon from "../../asset/overviewIcon.png";
import experiencesIcon from "../../asset/experiencesIcon.png";
import experiencesSelectedIcon from "../../asset/experiencesSelectedIcon.png";
import resourcesIcon from "../../asset/resourcesIocn.png";
import resourcesSelectedIcon from "../../asset/resourcesIconSelected.png";
import flagReportsIcon from "../../asset/flagreportsicon.png";
import flagReportsSelectedIcon from "../../asset/flagreportsselectedicon.png";
import settingsIcon from "../../asset/Vector (1).png";
import settingsSelectedIcon from "../../asset/settingIcon.png";
import styles from "./dashboard.module.css";

const menuItems = [
  { icon: overviewIcon, selectedIcon: overviewIcon, label: "Overview" },
  { icon: experiencesIcon, selectedIcon: experiencesSelectedIcon, label: "Experiences" },
  { icon: resourcesIcon, selectedIcon: resourcesSelectedIcon, label: "Resources" },
  { icon: flagReportsIcon, selectedIcon: flagReportsSelectedIcon, label: "Flag reports" },
  { icon: settingsIcon, selectedIcon: settingsSelectedIcon, label: "Settings" },
];

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l11-11-4-4L4 16v4Zm9.5-13.5 4 4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("Overview");
  const [hoveredSection, setHoveredSection] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [counts, setCounts] = useState({
    users: "—",
    posts: "—",
    postReports: "—",
    connectionReports: "—",
  });
  const [topExperiences, setTopExperiences] = useState([]);
  const [topResources, setTopResources] = useState([]);
  const [flagReports, setFlagReports] = useState([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [dataNotice, setDataNotice] = useState("");
  const [experienceType, setExperienceType] = useState(null);
  const [editingExperience, setEditingExperience] = useState(null);
  const [experienceGuidance, setExperienceGuidance] = useState("Self-led");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [experienceSaving, setExperienceSaving] = useState(false);
  const [experienceSaveStep, setExperienceSaveStep] = useState("");
  const [experienceError, setExperienceError] = useState("");
  const [experienceToDelete, setExperienceToDelete] = useState(null);
  const [experienceDeleting, setExperienceDeleting] = useState(false);
  const [experienceDeleteError, setExperienceDeleteError] = useState("");
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [resourceFile, setResourceFile] = useState(null);
  const [resourceSaving, setResourceSaving] = useState(false);
  const [resourceSaveStep, setResourceSaveStep] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [resourceDeleting, setResourceDeleting] = useState(false);
  const [resourceDeleteError, setResourceDeleteError] = useState("");
  const [flagAction, setFlagAction] = useState(null);
  const [flagActionSaving, setFlagActionSaving] = useState(false);
  const [flagActionError, setFlagActionError] = useState("");

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
            getDocs(query(collection(database, "experiences"), orderBy("createdAt", "desc"))),
            getDocs(query(collection(database, "resources"), orderBy("createdAt", "desc"))),
            getDocs(collection(database, "postReports")),
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
        if (contentResults[2].status === "fulfilled") {
          const reports = await Promise.all(
            contentResults[2].value.docs.map(async (reportDocument) => {
              const report = { id: reportDocument.id, ...reportDocument.data() };
              const postSnapshot = report.postId
                ? await getDoc(doc(database, "posts", report.postId))
                : null;
              const post = postSnapshot?.exists() ? postSnapshot.data() : {};
              const userId = report.reportedUserId || post.authorId || "";
              const userSnapshot = userId
                ? await getDoc(doc(database, "users", userId))
                : null;
              const user = userSnapshot?.exists() ? userSnapshot.data() : {};

              return {
                ...report,
                userId,
                userName: user.name || post.authorName || report.reportedUserName || "Unknown user",
                userPhotoUrl: user.photoURL || user.photoUrl || post.authorPhotoUrl || "",
                postContent: post.content || report.postContent || "Post is no longer available.",
              };
            })
          );
          setFlagReports(reports);
        } else {
          setDataNotice("Flag reports could not be loaded. Check the Firestore admin rules.");
        }
        setFlagsLoading(false);
      } catch {
        setDataNotice("Some database data could not be loaded. Admin Firestore permissions are required.");
        setFlagsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.replace("/");
  }

  function openExperienceForm(type) {
    setEditingExperience(null);
    setExperienceGuidance("Self-led");
    setExperienceType(type);
  }

  function openExperienceEditor(experience) {
    setEditingExperience(experience);
    setExperienceGuidance(experience.guidanceType || experience.type || "Self-led");
    setThumbnailUrl(experience.thumbnailUrl || "");
    setThumbnailFile(null);
    setExperienceError("");
    setExperienceType(experience.category || "Experience");
  }

  function closeExperienceForm() {
    setExperienceType(null);
    if (thumbnailUrl.startsWith("blob:")) URL.revokeObjectURL(thumbnailUrl);
    setThumbnailUrl("");
    setThumbnailFile(null);
    setExperienceError("");
    setExperienceSaveStep("");
    setExperienceGuidance("Self-led");
    setEditingExperience(null);
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

    if (thumbnailUrl.startsWith("blob:")) URL.revokeObjectURL(thumbnailUrl);
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
      let uploadedThumbnailUrl = editingExperience?.thumbnailUrl || "";

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
      const experienceDocument = {
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
        updatedAt: serverTimestamp(),
      };

      if (editingExperience) {
        await updateDoc(
          doc(getFirebaseDatabase(), "experiences", editingExperience.id),
          experienceDocument
        );
        setTopExperiences((items) =>
          items.map((item) =>
            item.id === editingExperience.id
              ? { ...item, ...experienceDocument, id: item.id }
              : item
          )
        );
      } else {
        const createdExperience = await addDoc(
          collection(getFirebaseDatabase(), "experiences"),
          {
            ...experienceDocument,
            createdBy: getFirebaseAuth().currentUser?.uid || "",
            createdAt: serverTimestamp(),
          }
        );
        setTopExperiences((items) => [
          { id: createdExperience.id, ...experienceDocument },
          ...items,
        ]);
      }

      closeExperienceForm();
      setDataNotice(
        editingExperience
          ? "Experience updated successfully."
          : "Experience created successfully. It is now available to the mobile app."
      );
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

  async function handleDeleteExperience() {
    if (!experienceToDelete) return;

    setExperienceDeleting(true);
    setExperienceDeleteError("");

    try {
      await deleteDoc(
        doc(getFirebaseDatabase(), "experiences", experienceToDelete.id)
      );
      setTopExperiences((items) =>
        items.filter((item) => item.id !== experienceToDelete.id)
      );
      setDataNotice("Experience deleted successfully.");
      setExperienceToDelete(null);
    } catch (error) {
      setExperienceDeleteError(
        error.code === "permission-denied"
          ? "Firebase blocked this delete. Check the Firestore admin rules."
          : "Unable to delete the experience. Please try again."
      );
    } finally {
      setExperienceDeleting(false);
    }
  }

  function openResourceForm(resource = null) {
    setEditingResource(resource);
    setResourceFile(null);
    setResourceError("");
    setResourceModalOpen(true);
  }

  function closeResourceForm() {
    setResourceModalOpen(false);
    setEditingResource(null);
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
    if (!resourceFile && !editingResource) {
      setResourceError("Please select a PDF file.");
      return;
    }

    setResourceSaving(true);
    setResourceError("");
    setResourceSaveStep(resourceFile ? "Uploading PDF..." : "Saving resource...");

    try {
      const formData = new FormData(event.currentTarget);
      let pdfUrl = editingResource?.pdfUrl || "";
      let fileName = editingResource?.fileName || "";

      if (resourceFile) {
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
        pdfUrl = await getDownloadURL(uploadResult.ref);
        fileName = resourceFile.name;
      }

      setResourceSaveStep("Saving resource...");
      const resourceDocument = {
        title: formData.get("title").trim(),
        name: formData.get("title").trim(),
        subject: formData.get("subject"),
        pages: Number(formData.get("pages")),
        ageRange: formData.get("ageRange"),
        keyStage: formData.get("keyStage"),
        pdfUrl,
        fileName,
        status: "published",
        updatedAt: serverTimestamp(),
      };

      if (editingResource) {
        await updateDoc(
          doc(getFirebaseDatabase(), "resources", editingResource.id),
          resourceDocument
        );
        setTopResources((items) => items.map((item) =>
          item.id === editingResource.id ? { ...item, ...resourceDocument, id: item.id } : item
        ));
      } else {
        const createdResource = await addDoc(
          collection(getFirebaseDatabase(), "resources"),
          {
            ...resourceDocument,
            createdBy: getFirebaseAuth().currentUser?.uid || "",
            createdAt: serverTimestamp(),
          }
        );
        setTopResources((items) => [
          { id: createdResource.id, ...resourceDocument },
          ...items,
        ]);
      }
      closeResourceForm();
      setDataNotice(editingResource ? "Resource updated successfully." : "Resource created successfully. It is now available to the mobile app.");
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

  async function handleDeleteResource() {
    if (!resourceToDelete) return;
    setResourceDeleting(true);
    setResourceDeleteError("");

    try {
      await deleteDoc(doc(getFirebaseDatabase(), "resources", resourceToDelete.id));
      setTopResources((items) => items.filter((item) => item.id !== resourceToDelete.id));
      setDataNotice("Resource deleted successfully.");
      setResourceToDelete(null);
    } catch (error) {
      setResourceDeleteError(
        error.code === "permission-denied"
          ? "Firebase blocked this delete. Check the Firestore admin rules."
          : "Unable to delete the resource. Please try again."
      );
    } finally {
      setResourceDeleting(false);
    }
  }

  async function handleFlagAction() {
    if (!flagAction) return;
    setFlagActionSaving(true);
    setFlagActionError("");

    try {
      const database = getFirebaseDatabase();
      const batch = writeBatch(database);
      batch.delete(doc(database, "postReports", flagAction.report.id));

      if (flagAction.type === "post" && flagAction.report.postId) {
        batch.delete(doc(database, "posts", flagAction.report.postId));
      }
      if (flagAction.type === "account" && flagAction.report.userId) {
        batch.delete(doc(database, "users", flagAction.report.userId));
      }

      await batch.commit();
      setFlagReports((items) => items.filter((item) => item.id !== flagAction.report.id));
      setDataNotice(flagAction.type === "post" ? "Flagged post deleted successfully." : "Flagged user profile deleted successfully.");
      setFlagAction(null);
    } catch (error) {
      setFlagActionError(
        error.code === "permission-denied"
          ? "Firebase blocked this action. Publish the updated Firestore rules first."
          : "Unable to complete this action. Please try again."
      );
    } finally {
      setFlagActionSaving(false);
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
          {activeSection !== "Experiences" && (
          <button className={styles.createAction} type="button" onClick={() => openResourceForm()}>
              Add a resource <span>+</span>
            </button>
          )}
          <button className={styles.logoutButton} onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav>
          {menuItems.map(({ icon, selectedIcon, label }) => (
            <button
              className={activeSection === label ? styles.activeMenu : ""}
              key={label}
              type="button"
              onClick={() => setActiveSection(label)}
              onMouseEnter={() => setHoveredSection(label)}
              onMouseLeave={() => setHoveredSection(null)}
            >
              <span>
                <Image
                  src={activeSection === label || hoveredSection === label ? selectedIcon : icon}
                  alt=""
                />
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarArt}>
          <Image src={classmatesIcon} alt="Classmates together" priority />
        </div>
      </aside>

      <section className={styles.content}>
        <div className={styles.titleBand}>
          {activeSection === "Overview" && <p>Admin dashboard</p>}
          <h1>{activeSection}</h1>
        </div>

        {dataNotice && <p className={styles.notice}>{dataNotice}</p>}

        {activeSection === "Overview" ? <><div className={styles.stats}>
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
                {topExperiences.slice(0, 6).map((experience) => (
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
                {topResources.slice(0, 6).map((resource) => (
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
        </div></> : activeSection === "Experiences" ? (
          <section className={styles.experiencesPanel}>
            <div className={styles.experiencesHeading}>
              <h2>Experiences</h2>
              <p>Experiences are ranked by how many users have selected ‘Done’</p>
            </div>
            {topExperiences.length ? (
              <ol className={styles.experiencesList}>
                {[...topExperiences]
                  .sort((a, b) => (b.doneCount || b.completedCount || 0) - (a.doneCount || a.completedCount || 0))
                  .map((experience) => (
                    <li key={experience.id}>
                      {experience.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.experienceThumbnail} src={experience.thumbnailUrl} alt="" />
                      ) : (
                        <span className={styles.experienceThumbnailPlaceholder} />
                      )}
                      <div className={styles.experienceDetails}>
                        <strong>{experience.name || "Untitled experience"}</strong>
                        <span>{experience.category || experience.subject || experience.type || "Experience"}</span>
                      </div>
                      <div className={styles.rowActions} aria-label={`Actions for ${experience.name || "experience"}`}>
                        <button type="button" aria-label="Edit experience" onClick={() => openExperienceEditor(experience)}><EditIcon /></button>
                        <button
                          type="button"
                          aria-label="Delete experience"
                          onClick={() => {
                            setExperienceDeleteError("");
                            setExperienceToDelete(experience);
                          }}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <div className={styles.experiencesEmpty}>No experiences to display yet.</div>
            )}
          </section>
        ) : activeSection === "Resources" ? (
          <section className={styles.experiencesPanel}>
            <div className={styles.experiencesHeading}>
              <h2>Resources</h2>
            </div>
            {topResources.length ? (
              <ol className={styles.resourceList}>
                {topResources.map((resource) => (
                  <li key={resource.id}>
                    <div className={styles.experienceDetails}>
                      <strong>{resource.name || resource.title || "Untitled resource"}</strong>
                      <span>{resource.subject || resource.type || "Resource"}</span>
                    </div>
                    <div className={styles.rowActions} aria-label={`Actions for ${resource.name || resource.title || "resource"}`}>
                      <button type="button" aria-label="Edit resource" onClick={() => openResourceForm(resource)}><EditIcon /></button>
                      <button
                        type="button"
                        aria-label="Delete resource"
                        onClick={() => {
                          setResourceDeleteError("");
                          setResourceToDelete(resource);
                        }}
                      ><DeleteIcon /></button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.experiencesEmpty}>No resources to display yet.</div>
            )}
          </section>
        ) : activeSection === "Flag reports" ? (
          <section className={`${styles.experiencesPanel} ${styles.flagsPanel}`}>
            <div className={styles.experiencesHeading}><h2>Flags</h2></div>
            {flagsLoading ? (
              <div className={styles.experiencesEmpty}>Loading flag reports...</div>
            ) : flagReports.length ? (
              <ul className={styles.flagsList}>
                {flagReports.map((report) => (
                  <li key={report.id}>
                    {report.userPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={report.userPhotoUrl} alt="" />
                    ) : (
                      <span className={styles.flagAvatar} />
                    )}
                    <div className={styles.flagDetails}>
                      <strong>{report.userName}</strong>
                      <p>{report.postContent}</p>
                    </div>
                    <div className={styles.flagActions}>
                      <button
                        type="button"
                        onClick={() => {
                          setFlagActionError("");
                          setFlagAction({ type: "post", report });
                        }}
                        disabled={!report.postId}
                      >Delete post</button>
                      <button
                        className={styles.deleteAccountButton}
                        type="button"
                        onClick={() => {
                          setFlagActionError("");
                          setFlagAction({ type: "account", report });
                        }}
                        disabled={!report.userId}
                      >Delete account</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.experiencesEmpty}>No flag reports to display.</div>
            )}
          </section>
        ) : (
          <section className={styles.sectionPlaceholder}>
            <h2>{activeSection}</h2>
            <p>This section is ready for its content.</p>
          </section>
        )}
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
                <h2 id="experience-title">{editingExperience ? "Edit experience" : "Create new experience"}</h2>
                <select name="category" form="experience-form" aria-label="Experience type" defaultValue={editingExperience?.category || ""} required>
                  <option value="" disabled>Experience type</option>
                  <option>Museums</option>
                  <option>Making</option>
                  <option>Nature</option>
                  <option>Heritage</option>
                  <option>Creative</option>
                  <option>Discovery</option>
                  <option>Active</option>
                  <option>Explore</option>
                </select>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeExperienceForm}>Close</button>
            </div>

            <form id="experience-form" className={styles.experienceForm} onSubmit={handleCreateExperience}>
              <label>
                <span>Experience name</span>
                <input name="name" required defaultValue={editingExperience?.name || ""} placeholder={experienceType === "Place" ? "eg. Natural History Museum" : "eg. Science discovery workshop"} />
              </label>
              <label>
                <span>{experienceType === "Place" ? "Hours" : "Date & time"}</span>
                <input name="schedule" required defaultValue={editingExperience?.schedule || ""} placeholder={experienceType === "Place" ? "Mon - Friday 10am - 5pm" : "Saturday 10am - 2pm"} />
              </label>
              <label>
                <span>{experienceType === "Place" ? "Location link" : "Location"}</span>
                <input name="location" required defaultValue={editingExperience?.location || ""} placeholder={experienceType === "Place" ? "Paste map or website link" : "Type in location"} />
              </label>
              <label>
                <span>Hosted by</span>
                <input name="hostedBy" required defaultValue={editingExperience?.hostedBy || ""} placeholder="Name of organisation/company" />
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
                <select name="subject" defaultValue={editingExperience?.subject || ""} required>
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
                  defaultValue={editingExperience?.description || ""}
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
                <label><span>Recommended age</span><select name="ageRange" required defaultValue={editingExperience?.ageRange || ""}><option value="" disabled>Select age</option><option>2-4 years</option><option>5-7 years</option><option>8-11 years</option><option>12-18 years</option><option>All ages</option></select></label>
                <label><span>Indoor/Outdoor</span><select name="environment" required defaultValue={editingExperience?.environment || ""}><option value="" disabled>Select</option><option>Indoor</option><option>Outdoor</option><option>Both</option></select></label>
                <label><span>Is it free?</span><select name="isFree" required defaultValue={editingExperience ? (editingExperience.isFree ? "Yes" : "No") : ""}><option value="" disabled>Select</option><option>Yes</option><option>No</option></select></label>
                <label><span>Price</span><input name="price" type="number" min="0" step="0.01" defaultValue={editingExperience?.price ?? ""} placeholder="£00.00" /></label>
                <label><span>Booking Link</span><input name="bookingLink" type="url" defaultValue={editingExperience?.bookingLink || ""} placeholder="Paste booking link for book CTA" /></label>
              </div>

              {experienceError && <p className={styles.experienceError} role="alert">{experienceError}</p>}
              <button className={styles.submitExperience} type="submit" disabled={experienceSaving}>
                {experienceSaving ? experienceSaveStep : editingExperience ? "Save changes" : "Create experience"}
              </button>
            </form>
          </section>
        </div>
      )}

      {experienceToDelete && (
        <div className={styles.modalOverlay} role="presentation">
          <section
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-experience-title"
            aria-describedby="delete-experience-description"
          >
            <span className={styles.deleteDialogIcon}><DeleteIcon /></span>
            <h2 id="delete-experience-title">Delete experience?</h2>
            <p id="delete-experience-description">
              Are you sure you want to delete <strong>{experienceToDelete.name || "this experience"}</strong>?
              This action cannot be undone.
            </p>
            {experienceDeleteError && <p className={styles.deleteError} role="alert">{experienceDeleteError}</p>}
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                onClick={() => setExperienceToDelete(null)}
                disabled={experienceDeleting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteButton}
                type="button"
                onClick={handleDeleteExperience}
                disabled={experienceDeleting}
              >
                {experienceDeleting ? "Deleting..." : "Delete experience"}
              </button>
            </div>
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
                <h2 id="resource-title">{editingResource ? "Edit resource" : "Upload a resource"}</h2>
                <select name="subject" form="resource-form" aria-label="Resource subject category" defaultValue={editingResource?.subject || ""} required>
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
                  <input name="title" required defaultValue={editingResource?.title || editingResource?.name || ""} placeholder="e.g. Vikings: Raiders, Traders & Explorers" />
                </label>
                <label>
                  <span>Age</span>
                  <select name="ageRange" required defaultValue={editingResource?.ageRange || ""}>
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
                  <select name="keyStage" required defaultValue={editingResource?.keyStage || ""}>
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
                  <input name="pages" type="number" min="1" required defaultValue={editingResource?.pages || ""} placeholder="1" />
                </label>
                <label className={styles.pdfUploadField}>
                  <input type="file" accept="application/pdf,.pdf" onChange={handleResourceFile} />
                  <span>{resourceFile ? resourceFile.name : editingResource?.fileName || "Click to upload PDF"}</span>
                </label>
              </div>

              {resourceError && <p className={styles.resourceError} role="alert">{resourceError}</p>}
              <button className={styles.submitExperience} type="submit" disabled={resourceSaving}>
                {resourceSaving ? resourceSaveStep : editingResource ? "Save changes" : "Create resource"}
              </button>
            </form>
          </section>
        </div>
      )}

      {resourceToDelete && (
        <div className={styles.modalOverlay} role="presentation">
          <section className={styles.deleteDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-resource-title">
            <span className={styles.deleteDialogIcon}><DeleteIcon /></span>
            <h2 id="delete-resource-title">Delete resource?</h2>
            <p>Are you sure you want to delete <strong>{resourceToDelete.name || resourceToDelete.title || "this resource"}</strong>? This action cannot be undone.</p>
            {resourceDeleteError && <p className={styles.deleteError} role="alert">{resourceDeleteError}</p>}
            <div className={styles.deleteDialogActions}>
              <button type="button" onClick={() => setResourceToDelete(null)} disabled={resourceDeleting}>Cancel</button>
              <button className={styles.confirmDeleteButton} type="button" onClick={handleDeleteResource} disabled={resourceDeleting}>
                {resourceDeleting ? "Deleting..." : "Delete resource"}
              </button>
            </div>
          </section>
        </div>
      )}

      {flagAction && (
        <div className={styles.modalOverlay} role="presentation">
          <section className={styles.deleteDialog} role="alertdialog" aria-modal="true" aria-labelledby="flag-action-title">
            <span className={styles.deleteDialogIcon}><DeleteIcon /></span>
            <h2 id="flag-action-title">{flagAction.type === "post" ? "Delete flagged post?" : "Delete flagged account?"}</h2>
            <p>
              {flagAction.type === "post"
                ? "The original post and this report will be permanently removed."
                : `The Firestore profile for ${flagAction.report.userName} and this report will be permanently removed.`}
            </p>
            {flagActionError && <p className={styles.deleteError} role="alert">{flagActionError}</p>}
            <div className={styles.deleteDialogActions}>
              <button type="button" onClick={() => setFlagAction(null)} disabled={flagActionSaving}>Cancel</button>
              <button className={styles.confirmDeleteButton} type="button" onClick={handleFlagAction} disabled={flagActionSaving}>
                {flagActionSaving ? "Deleting..." : flagAction.type === "post" ? "Delete post" : "Delete account"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

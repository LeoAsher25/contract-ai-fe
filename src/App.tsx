import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UploadPage from "./components/UploadPage";
import ContractDetailsPage from "./components/ContractDetailsPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/details/:id" element={<ContractDetailsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
